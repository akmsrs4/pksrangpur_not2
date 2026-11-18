/**
 * Automated Audit & Financial Integrity Verification Suite
 * Run with: npx tsx scripts/verify_audit.ts
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message} (expected=${String(expected)}, actual=${String(actual)})`);
  }
}

// Install clean in-memory localStorage mock before importing store
const memoryStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStorage.set(key, String(value));
  },
  removeItem: (key: string) => {
    memoryStorage.delete(key);
  },
  clear: () => {
    memoryStorage.clear();
  },
  key: (index: number) => Array.from(memoryStorage.keys())[index] ?? null,
  get length() {
    return memoryStorage.size;
  },
};

(globalThis as unknown as { localStorage: Storage }).localStorage = mockLocalStorage as unknown as Storage;

async function runAuditTests() {
  const { store, roundBDT } = await import('../src/db/store.ts');

  console.log('1. Verifying clean initial production state (0 demo data)...');
  assertEqual(store.isSandboxDemoActive, false, 'Sandbox mode must be OFF initially');
  assertEqual(store.isAuthenticated, false, 'User must be logged out initially');
  assertEqual(store.members.length, 0, 'Initial members must be 0');
  assertEqual(store.committees.length, 0, 'Initial committees must be 0');
  assertEqual(store.notices.length, 0, 'Initial notices must be 0');
  assertEqual(store.transactions.length, 0, 'Initial transactions must be 0');
  assertEqual(store.aidApplications.length, 0, 'Initial aid applications must be 0');
  assertEqual(store.settings.isCommitteePubliclyVisible, false, 'Committee must default to unpublished');

  const initFundSum = roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0));
  const initAccSum = roundBDT(store.accounts.reduce((s, a) => s + a.currentBalance, 0));
  assertEqual(initFundSum, 0, 'Initial funds sum must be 0 BDT');
  assertEqual(initAccSum, 0, 'Initial accounts sum must be 0 BDT');

  console.log('2. Verifying unauthenticated RBAC blocks...');
  assertEqual(
    store.addTransaction({
      voucherNo: 'UNAUTH-01',
      type: 'income',
      fundId: 'fund-gen',
      accountId: 'acc-bank',
      amount: 500,
      category: 'Test',
      donorOrPayee: 'Tester',
      description: 'Should fail',
    }).success,
    false,
    'Unauthenticated addTransaction must fail'
  );
  assertEqual(
    store.addNotice({ title: 'Hack', category: 'general', content: 'Test', isPinned: false, author: 'Anon' }).success,
    false,
    'Unauthenticated addNotice must fail'
  );
  assertEqual(
    store.addFund({ name: 'Hack Fund', code: 'HACK', description: 'X', isActive: true, isDefault: false }).success,
    false,
    'Unauthenticated addFund must fail'
  );
  assertEqual(store.loadDemoSandboxData().success, false, 'Unauthenticated sandbox toggle must fail');
  assertEqual(store.resetToCleanProduction().success, false, 'Unauthenticated reset must fail');

  console.log('3. Verifying first-time Super Admin bootstrap & officer approval flow...');
  const regSuper = await store.registerAdminLocal({
    fullName: 'মাস্টার সুপার অ্যাডমিন',
    email: 'super@patgram.test',
    password: 'Password@123',
  });
  assert(regSuper.success && regSuper.isFirstSuperAdmin, 'First account must become active Super Admin');
  assertEqual(store.authenticatedRole, 'super_admin', 'Authenticated role must be super_admin');

  // Register pending officer (finance_secretary)
  await store.logout();
  const regFin = await store.registerAdminLocal({
    fullName: 'অর্থ সম্পাদক',
    email: 'finance@patgram.test',
    password: 'Password@123',
    requestedRole: 'finance_secretary',
  });
  assert(regFin.success && regFin.pendingApproval, 'Second registration must require Super Admin approval');

  const pendingLogin = await store.loginAdminLocal('finance@patgram.test', 'Password@123');
  assertEqual(pendingLogin.success, false, 'Pending officer must NOT be able to login');

  // Login Super Admin with wrong password vs right password
  const wrongLogin = await store.loginAdminLocal('super@patgram.test', 'WrongPass');
  assertEqual(wrongLogin.success, false, 'Wrong password must be rejected');
  const superLogin = await store.loginAdminLocal('super@patgram.test', 'Password@123');
  assertEqual(superLogin.success, true, 'Super Admin login with valid password must succeed');

  // Approve finance_secretary and create president
  const finAccount = store.adminAccounts.find((a) => a.email === 'finance@patgram.test');
  assert(finAccount, 'Finance account must exist');
  assertEqual(store.updateAdminAccount(finAccount.id, { status: 'active' }).success, true, 'Super Admin can activate officer');

  const createPres = await store.createOfficerBySuperAdmin({
    fullName: 'সমিতি সভাপতি',
    email: 'president@patgram.test',
    role: 'president',
    password: 'Password@123',
  });
  assertEqual(createPres.success, true, 'Super Admin can create active President account');

  console.log('4. Verifying financial engine, overdraft prevention, dual-balance & decimal accuracy...');
  // Expense on 0 balance must fail
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-ZERO-EXP',
      type: 'expense',
      fundId: 'fund-1',
      accountId: 'acc-1',
      amount: 100,
      category: 'অফিস খরচ',
      donorOrPayee: 'দোকান',
      description: 'Test zero balance expense',
      autoApprove: true,
    }).success,
    false,
    'Expense on zero balance must be rejected'
  );

  // Transfer on 0 balance must fail
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-ZERO-TRN',
      type: 'fund_transfer',
      fundId: 'fund-1',
      accountId: 'acc-1',
      toFundId: 'fund-2',
      toAccountId: 'acc-2',
      amount: 100,
      category: 'স্থানান্তর',
      donorOrPayee: 'অভ্যন্তরীণ',
      description: 'Test zero transfer',
      autoApprove: true,
    }).success,
    false,
    'Fund transfer on zero balance must be rejected'
  );

  // Pending transaction should not change balances until approved
  const pendingInc = store.addTransaction({
    voucherNo: 'V-PEND-01',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 500,
    category: 'চাঁদা',
    donorOrPayee: 'সদস্য ক',
    description: 'Pending income',
    autoApprove: false,
  });
  assert(pendingInc.success && pendingInc.transaction, `Pending income creation succeeds: ${pendingInc.error}`);
  assertEqual(
    store.funds.find((f) => f.id === 'fund-1')?.currentBalance,
    0,
    'Balance must stay 0 before approval'
  );

  // Reject with short reason fails, valid reason succeeds & balance remains 0
  assertEqual(store.rejectTransaction(pendingInc.transaction.id, 'no').success, false, 'Short reject reason rejected');
  assertEqual(
    store.rejectTransaction(pendingInc.transaction.id, 'তথ্য অসম্পূর্ণ ছিল').success,
    true,
    'Valid reject succeeds'
  );
  assertEqual(
    store.funds.find((f) => f.id === 'fund-1')?.currentBalance,
    0,
    'Rejected transaction must not affect balance'
  );

  // Income 1000 (approved)
  const inc1 = store.addTransaction({
    voucherNo: 'V-INC-1000',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 1000,
    category: 'মাসিক চাঁদা',
    donorOrPayee: 'রহিম উদ্দিন',
    description: 'Initial deposit',
    autoApprove: true,
  });
  assert(inc1.success && inc1.transaction, `Approved 1000 income must succeed: ${inc1.error}`);
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 1000, 'fund-1 = 1000');
  assertEqual(store.accounts.find((a) => a.id === 'acc-1')?.currentBalance, 1000, 'acc-1 = 1000');

  // Duplicate voucher blocked
  assertEqual(
    store.addTransaction({
      voucherNo: 'v-inc-1000',
      type: 'income',
      fundId: 'fund-1',
      accountId: 'acc-1',
      amount: 100,
      category: 'Test',
      donorOrPayee: 'Dup',
      description: 'Duplicate check',
      autoApprove: true,
    }).success,
    false,
    'Case-insensitive duplicate voucherNo must be rejected'
  );

  // Expense 300 -> 700
  const exp1 = store.addTransaction({
    voucherNo: 'V-EXP-300',
    type: 'expense',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 300,
    category: 'কার্যালয় ব্যয়',
    donorOrPayee: 'ভেন্ডর',
    description: 'Office expense',
    autoApprove: true,
  });
  assertEqual(exp1.success, true, 'Expense 300 must succeed');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 700, 'fund-1 = 700');

  // Overdraft Expense 1200 -> rejected, stays 700
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-EXP-1200',
      type: 'expense',
      fundId: 'fund-1',
      accountId: 'acc-1',
      amount: 1200,
      category: 'অতিরিক্ত খরচ',
      donorOrPayee: 'ভেন্ডর',
      description: 'Overdraft test',
      autoApprove: true,
    }).success,
    false,
    'Overdraft expense 1200 must be rejected'
  );
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 700, 'Balance stays 700 after failed overdraft');

  // Transfer 200 (fund-1/acc-1 -> fund-2/acc-2)
  const trn1 = store.addTransaction({
    voucherNo: 'V-TRN-200',
    type: 'fund_transfer',
    fundId: 'fund-1',
    accountId: 'acc-1',
    toFundId: 'fund-2',
    toAccountId: 'acc-2',
    amount: 200,
    category: 'তহবিল স্থানান্তর',
    donorOrPayee: 'অভ্যন্তরীণ',
    description: 'Edu allocation',
    autoApprove: true,
  });
  assertEqual(trn1.success, true, 'Fund transfer 200 must succeed');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 500, 'fund-1 = 500');
  assertEqual(store.funds.find((f) => f.id === 'fund-2')?.currentBalance, 200, 'fund-2 = 200');
  assertEqual(store.accounts.find((a) => a.id === 'acc-1')?.currentBalance, 500, 'acc-1 = 500');
  assertEqual(store.accounts.find((a) => a.id === 'acc-2')?.currentBalance, 200, 'acc-2 = 200');

  // Same source & dest rejected
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-TRN-SAME',
      type: 'fund_transfer',
      fundId: 'fund-1',
      accountId: 'acc-1',
      toFundId: 'fund-1',
      toAccountId: 'acc-1',
      amount: 50,
      category: 'Test',
      donorOrPayee: 'Self',
      description: 'Same src/dest',
      autoApprove: true,
    }).success,
    false,
    'Identical source and destination transfer must be rejected'
  );

  // Decimal precision check
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-DEC-1',
      type: 'income',
      fundId: 'fund-3',
      accountId: 'acc-3',
      amount: 100.15,
      category: 'অনুদান',
      donorOrPayee: 'দাতা ১',
      description: 'Float test 1',
      autoApprove: true,
    }).success,
    true,
    'Decimal income 100.15 succeeds'
  );
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-DEC-2',
      type: 'income',
      fundId: 'fund-3',
      accountId: 'acc-3',
      amount: 200.25,
      category: 'অনুদান',
      donorOrPayee: 'দাতা ২',
      description: 'Float test 2',
      autoApprove: true,
    }).success,
    true,
    'Decimal income 200.25 succeeds'
  );
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-DEC-3',
      type: 'expense',
      fundId: 'fund-3',
      accountId: 'acc-3',
      amount: 50.4,
      category: 'চিকিৎসা',
      donorOrPayee: 'রোগী',
      description: 'Float test 3',
      autoApprove: true,
    }).success,
    true,
    'Decimal expense 50.40 succeeds'
  );
  assertEqual(store.funds.find((f) => f.id === 'fund-3')?.currentBalance, 250, 'Decimal arithmetic must equal exact 250');

  // Dual balance parity check
  const midFundSum = roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0));
  const midAccSum = roundBDT(store.accounts.reduce((s, a) => s + a.currentBalance, 0));
  assertEqual(midFundSum, 950, 'Total funds must equal 950');
  assertEqual(midAccSum, 950, 'Total accounts must equal 950');

  console.log('5. Verifying Financial Correction workflow, 30,000 BDT threshold, Super Admin bypass & Overdraft Guard...');
  // Add 50,000 income first as Super Admin
  const bigInc = store.addTransaction({
    voucherNo: 'V-BIG-50K',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 50000,
    category: 'বিশেষ অনুদান',
    donorOrPayee: 'বড় দাতা',
    description: 'Large donation',
    autoApprove: true,
  });
  assert(bigInc.success && bigInc.transaction, `50,000 income must succeed: ${bigInc.error}`);

  // Switch to Finance Secretary login
  await store.logout();
  assertEqual((await store.loginAdminLocal('finance@patgram.test', 'Password@123')).success, true, 'Finance Sec logs in');

  // Finance sec cannot call Super Admin tools
  assertEqual(
    store.updateRolePermission('general_admin', 'can_approve_finance', true).success,
    false,
    'Finance Secretary cannot edit role permissions'
  );

  // Reason validation
  assertEqual(
    store.requestCorrection({
      originalTransactionId: inc1.transaction.id,
      correctedAmount: 1500,
      correctedCategory: inc1.transaction.category,
      correctedFundId: inc1.transaction.fundId,
      correctedAccountId: inc1.transaction.accountId,
      correctedDonorOrPayee: inc1.transaction.donorOrPayee,
      correctedDescription: inc1.transaction.description,
      correctionReason: 'ok',
    }).success,
    false,
    'Correction reason < 5 chars must be rejected'
  );

  // Overdraft correction test on fund-4 with 1000 in, 600 out => 400 left
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');
  const reliefInc = store.addTransaction({
    voucherNo: 'V-REL-1000',
    type: 'income',
    fundId: 'fund-4',
    accountId: 'acc-3',
    amount: 1000,
    category: 'ত্রাণ',
    donorOrPayee: 'দাতা',
    description: 'Relief in',
    autoApprove: true,
  });
  assert(reliefInc.success && reliefInc.transaction, 'Relief 1000 income ok');
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-REL-EXP-600',
      type: 'expense',
      fundId: 'fund-4',
      accountId: 'acc-3',
      amount: 600,
      category: 'ত্রাণ বিতরণ',
      donorOrPayee: 'সুবিধাভোগী',
      description: 'Relief out',
      autoApprove: true,
    }).success,
    true,
    'Relief 600 expense ok'
  );
  // fund-4 now has 400. Correcting V-REL-1000 down to 200 would yield 400 - 1000 + 200 = -400 -> MUST FAIL!
  assertEqual(
    store.requestCorrection({
      originalTransactionId: reliefInc.transaction.id,
      correctedAmount: 200,
      correctedCategory: 'ত্রাণ',
      correctedFundId: 'fund-4',
      correctedAccountId: 'acc-3',
      correctedDonorOrPayee: 'দাতা',
      correctedDescription: 'Overdraft correction test',
      correctionReason: 'ভুলবশত বেশি এন্ট্রি হয়েছিল সমন্বয় করছি',
    }).success,
    false,
    'Correction causing negative balance (-400) MUST BE REJECTED'
  );
  assertEqual(store.funds.find((f) => f.id === 'fund-4')?.currentBalance, 400, 'fund-4 remains 400');

  // Now switch back to Finance Secretary to test <=30k direct vs >30k pending dual approval
  await store.logout();
  await store.loginAdminLocal('finance@patgram.test', 'Password@123');

  const smallCorr = store.requestCorrection({
    originalTransactionId: inc1.transaction.id,
    correctedAmount: 1500, // delta = 500 <= 30000
    correctedCategory: inc1.transaction.category,
    correctedFundId: inc1.transaction.fundId,
    correctedAccountId: inc1.transaction.accountId,
    correctedDonorOrPayee: inc1.transaction.donorOrPayee,
    correctedDescription: 'Updated 1500',
    correctionReason: 'রসিদ অনুযায়ী প্রকৃত আদায় ১,৫০০ টাকা',
  });
  assert(smallCorr.success && smallCorr.correction, `Small correction <=30k succeeds: ${smallCorr.error}`);
  assertEqual(smallCorr.correction.approvalStatus, 'approved', 'Delta <= 30,000 is directly approved');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 51000, 'fund-1 updated by +500 to 51,000');

  // Large correction delta = 40,000 > 30,000
  const bigCorr = store.requestCorrection({
    originalTransactionId: bigInc.transaction.id,
    correctedAmount: 90000,
    correctedCategory: bigInc.transaction.category,
    correctedFundId: bigInc.transaction.fundId,
    correctedAccountId: bigInc.transaction.accountId,
    correctedDonorOrPayee: bigInc.transaction.donorOrPayee,
    correctedDescription: 'Updated 90k',
    correctionReason: 'ব্যাংক স্টেটমেন্ট অনুযায়ী অনুদান ৯০,০০০ টাকা ছিল',
  });
  assert(bigCorr.success && bigCorr.correction, `Large correction proposal succeeds: ${bigCorr.error}`);
  assertEqual(bigCorr.correction.requiresDualApproval, true, 'Delta > 30,000 must require dual approval');
  assertEqual(bigCorr.correction.approvalStatus, 'pending_approval', 'Large correction must stay pending_approval');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 51000, 'Balance MUST NOT change before dual approval');

  // Duplicate pending correction on same txn blocked
  assertEqual(
    store.requestCorrection({
      originalTransactionId: bigInc.transaction.id,
      correctedAmount: 85000,
      correctedCategory: bigInc.transaction.category,
      correctedFundId: bigInc.transaction.fundId,
      correctedAccountId: bigInc.transaction.accountId,
      correctedDonorOrPayee: bigInc.transaction.donorOrPayee,
      correctedDescription: 'Dup pending',
      correctionReason: 'দ্বিতীয় সংশোধনী প্রস্তাবের চেষ্টা',
    }).success,
    false,
    'Concurrent duplicate pending correction on same transaction must be blocked'
  );

  // Even if Finance Sec had can_approve_finance enabled, self-approval must be blocked
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');
  store.updateRolePermission('finance_secretary', 'can_approve_finance', true);
  await store.logout();
  await store.loginAdminLocal('finance@patgram.test', 'Password@123');
  assertEqual(
    store.approveCorrection(bigCorr.correction.id).success,
    false,
    'Proposer MUST NOT be allowed to self-approve their own correction'
  );

  // Restore finance_secretary can_approve_finance = false, then approve as President
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');
  store.updateRolePermission('finance_secretary', 'can_approve_finance', false);
  await store.logout();
  await store.loginAdminLocal('president@patgram.test', 'Password@123');
  assertEqual(store.approveCorrection(bigCorr.correction.id, 'যাচাইকৃত').success, true, 'President approves >30k correction');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 91000, 'fund-1 updated to 91,000 (+40k)');

  // Super Admin direct large correction (Decision 2.ক)
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');
  const superCorr = store.requestCorrection({
    originalTransactionId: bigInc.transaction.id,
    correctedAmount: 45000, // delta 45,000 > 30,000
    correctedCategory: bigInc.transaction.category,
    correctedFundId: bigInc.transaction.fundId,
    correctedAccountId: bigInc.transaction.accountId,
    correctedDonorOrPayee: bigInc.transaction.donorOrPayee,
    correctedDescription: 'Super admin direct fix',
    correctionReason: 'সুপার অ্যাডমিন চূড়ান্ত ব্যাংক রিকনসিলিয়েশন সমন্বয়',
  });
  assert(superCorr.success && superCorr.correction, 'Super Admin direct large correction succeeds');
  assertEqual(superCorr.correction.approvalStatus, 'approved', 'Super Admin correction is directly approved (Decision 2.ক)');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 46000, 'fund-1 = 46,000 after Super Admin correction');

  console.log('6. Verifying Sandbox Demo isolation & Real Data Snapshot restore...');
  const realTotalBeforeSandbox = roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0));
  const realTxnCountBeforeSandbox = store.transactions.length;

  assertEqual(store.loadDemoSandboxData().success, true, 'Super Admin can activate Demo Sandbox');
  assertEqual(store.isSandboxDemoActive, true, 'Sandbox flag is active');
  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    687500,
    'Sandbox loads isolated 687,500 BDT demo dataset'
  );
  assertEqual(store.notices.length > 0, true, 'Sandbox loads sample notices');

  assertEqual(store.exitDemoSandboxData().success, true, 'Super Admin can exit Demo Sandbox');
  assertEqual(store.isSandboxDemoActive, false, 'Sandbox flag is cleared');
  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    realTotalBeforeSandbox,
    'Real fund total restored identically after exiting sandbox'
  );
  assertEqual(store.transactions.length, realTxnCountBeforeSandbox, 'Real transactions restored identically');

  console.log('7. Verifying Backup JSON export, validation, corruption rejection & full restore...');
  const backupJson = store.exportFullBackupJSON();
  const validCheck = store.validateBackupJSON(backupJson);
  assert(validCheck.isValid && validCheck.summary?.isDualBalanceMatched, 'Exported backup passes dry-run & dual balance parity');

  // Corrupt negative balance check
  const parsedForCorrupt = JSON.parse(backupJson);
  parsedForCorrupt.data.funds[0].currentBalance = -50;
  assertEqual(
    store.validateBackupJSON(JSON.stringify(parsedForCorrupt)).isValid,
    false,
    'Backup with negative balance must fail validation'
  );

  // Corrupt duplicate voucher check
  const parsedForDup = JSON.parse(backupJson);
  if (parsedForDup.data.transactions.length >= 2) {
    parsedForDup.data.transactions[1].voucherNo = parsedForDup.data.transactions[0].voucherNo;
    assertEqual(
      store.validateBackupJSON(JSON.stringify(parsedForDup)).isValid,
      false,
      'Backup with duplicate voucherNo must fail validation'
    );
  }

  // Clean reset & restore check
  assertEqual(store.resetToCleanProduction().success, true, 'Clean production reset succeeds');
  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    0,
    'Clean production reset clears all balances to 0'
  );
  assertEqual(store.transactions.length, 0, 'Clean production reset clears transactions');

  assertEqual(store.restoreFromBackupJSON(backupJson).success, true, 'Restore from valid backup JSON succeeds');
  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    realTotalBeforeSandbox,
    'Restored fund sum matches pre-reset real balance exactly'
  );
  assertEqual(
    roundBDT(store.accounts.reduce((s, a) => s + a.currentBalance, 0)),
    realTotalBeforeSandbox,
    'Restored account sum matches pre-reset real balance exactly'
  );

  console.log('8. Verifying v2 improvements: 2000 est. year, Founders, Wing isolation, Pending Delete, ৳0 Reversal & Safe Fund Delete...');
  // 8.1 Established year 2000 & Default Founders (2)
  assertEqual(store.settings.establishedYear, 2000, 'Established year must be 2000');
  assertEqual(store.settings.founders?.length, 2, 'Default founders count must be 2');

  // 8.2 Individual officer permission override & Export PDF configurable permission
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');
  const genAdminCreate = await store.createOfficerBySuperAdmin({
    fullName: 'সাধারণ সদস্য অ্যাডমিন',
    email: 'genadmin@patgram.test',
    role: 'general_admin',
    password: 'Password@123',
  });
  assertEqual(genAdminCreate.success, true, 'Super Admin can create general_admin');
  const genAdminAcc = store.adminAccounts.find((a) => a.email === 'genadmin@patgram.test');
  assert(genAdminAcc, 'general_admin account must exist');

  assertEqual(
    store.updateRolePermission('general_admin', 'can_export_reports', true).success,
    true,
    'Super Admin can grant can_export_reports to general_admin'
  );
  assertEqual(
    store.getEffectivePermissions('general_admin').can_export_reports,
    true,
    'general_admin role effective permission reflects can_export_reports = true'
  );
  assertEqual(
    store.updateUserPermission(genAdminAcc.id, 'general_admin', 'can_view_finance', true).success,
    true,
    'Super Admin can set individual officer permission override'
  );
  assertEqual(
    store.getUserPermissionsForAdminView(genAdminAcc.id, 'general_admin').perms.can_view_finance,
    true,
    'Individual officer permission override takes effect'
  );
  assertEqual(
    store.resetUserPermissionsToRole(genAdminAcc.id, 'general_admin').success,
    true,
    'Super Admin can reset officer permissions back to role preset'
  );

  // 8.3 Member Wing Isolation & Direct Admin CRUD
  await store.logout();
  assertEqual((await store.loginAdminLocal('genadmin@patgram.test', 'Password@123')).success, true, 'general_admin logs in');
  assertEqual(store.canManageMemberType('general'), true, 'general_admin can manage general members');
  assertEqual(store.canManageMemberType('student'), false, 'general_admin must NOT manage student members');

  // Attempt to add a student member as general_admin -> MUST FAIL
  assertEqual(
    store.addMemberByAdmin({
      type: 'student',
      fullNameBn: 'ছাত্র সদস্য টেস্ট',
      fullNameEn: 'Student Test',
      phone: '01700000001',
      email: '',
      bloodGroup: 'O+',
      patgramAddress: { village: 'পাটগ্রাম', union: 'পাটগ্রাম' },
      rangpurAddress: { area: 'জাহাজ কোম্পানি', thana: 'কোতোয়ালী' },
      institution: 'কারমাইকেল কলেজ',
    }).success,
    false,
    'general_admin must be blocked from adding student member'
  );

  // Add a general member as general_admin -> MUST SUCCEED
  const addedGen = store.addMemberByAdmin({
    type: 'general',
    fullNameBn: 'রফিকুল ইসলাম',
    fullNameEn: 'Rofiqul Islam',
    phone: '01711000002',
    email: 'rofiq@example.com',
    bloodGroup: 'B+',
    patgramAddress: { village: 'বাউরা', union: 'বাউরা' },
    rangpurAddress: { area: 'ধাপ', thana: 'কোতোয়ালী' },
    professionOrDesignation: 'শিক্ষক',
  });
  assert(addedGen.success && addedGen.membershipId, `general_admin adds general member: ${addedGen.error}`);
  const genMemberObj = store.members.find((m) => m.membershipId === addedGen.membershipId);
  assert(genMemberObj, 'Added general member exists in store');

  // Update serial & duplicate check
  assertEqual(
    store.updateMemberSerial(genMemberObj.id, 'PKS-GEN-2000-001').success,
    true,
    'general_admin can edit general member serial number'
  );
  // Public member application & aid application
  const pubApply = await store.addMemberApplication({
    type: 'student',
    fullNameBn: 'সাদিকুল ইসলাম',
    fullNameEn: 'Sadikul Islam',
    phone: '01799887766',
    email: '',
    bloodGroup: 'A+',
    patgramAddress: { village: 'রসুলগঞ্জ', union: 'পাটগ্রাম' },
    rangpurAddress: { area: 'লালবাগ', thana: 'কোতোয়ালী' },
    institution: 'বেগম রোকেয়া বিশ্ববিদ্যালয়',
  });
  assert(pubApply.success && pubApply.membershipId, `Public member application succeeds: ${pubApply.error}`);
  assertEqual(
    pubApply.membershipId.startsWith('APP-'),
    true,
    'Pending public application must receive temporary APP- tracking ID instead of consuming official serial'
  );
  const stuMemberObj = store.members.find((m) => m.membershipId === pubApply.membershipId);
  assert(stuMemberObj, 'Applied student member exists in store');
  assertEqual(stuMemberObj.status, 'pending', 'Applied public member starts as pending');

  // Pending general application rejection test (never consumes PKS-GEN serial)
  const rejApply = await store.addMemberApplication({
    type: 'general',
    fullNameBn: 'বাতিলযোগ্য আবেদন',
    fullNameEn: 'Rejectable App',
    phone: '01788112233',
    email: '',
    bloodGroup: 'O+',
    patgramAddress: { village: 'পাটগ্রাম', union: 'পাটগ্রাম' },
    rangpurAddress: { area: 'ধাপ', thana: 'কোতোয়ালী' },
    professionOrDesignation: 'ব্যবসায়ী',
  });
  assert(rejApply.success && rejApply.membershipId.startsWith('APP-'), 'General pending application uses APP- ID');
  const rejMemberObj = store.members.find((m) => m.membershipId === rejApply.membershipId);
  assert(rejMemberObj, 'Pending general member exists');
  assertEqual(
    store.updateMemberStatus(rejMemberObj.id, 'rejected').success,
    true,
    'general_admin can reject pending general application'
  );
  assertEqual(
    store.members.find((m) => m.id === rejMemberObj.id)?.status,
    'rejected',
    'Rejected application status stays rejected'
  );
  assertEqual(
    store.members.find((m) => m.id === rejMemberObj.id)?.membershipId.startsWith('APP-'),
    true,
    'Rejected application must NEVER receive official PKS-GEN serial'
  );

  // general_admin cannot edit/delete/approve student member
  assertEqual(
    store.updateMemberSerial(stuMemberObj.id, 'PKS-STU-999').success,
    false,
    'general_admin cannot edit student member serial'
  );
  assertEqual(
    store.updateMemberStatus(stuMemberObj.id, 'active').success,
    false,
    'general_admin cannot approve student member application'
  );
  assertEqual(
    store.deleteMember(stuMemberObj.id).success,
    false,
    'general_admin cannot delete student member'
  );
  // general_admin CAN delete general member
  assertEqual(
    store.deleteMember(genMemberObj.id).success,
    true,
    'general_admin can delete general member'
  );
  assertEqual(
    store.deleteMember(rejMemberObj.id).success,
    true,
    'general_admin can delete rejected general application cleanly'
  );

  // Public aid application
  const aidRes = await store.submitAidApplication({
    applicantName: 'আবেদনকারী',
    phone: '01712345678',
    type: 'medical_assistance',
    patgramAddress: 'বুড়িমারী, পাটগ্রাম',
    currentAddress: 'মেডিকেল মোড়, রংপুর',
    requestedAmount: 5000,
    reason: 'জরুরি চিকিৎসার জন্য আর্থিক সহায়তা প্রয়োজন',
  });
  assertEqual(aidRes.success, true, `Public aid application succeeds: ${aidRes.error}`);

  // 8.4 Pending transaction delete, ৳0 Void/Reversal, Student Approval Serial & Test Officer Delete
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');

  // Super Admin approves pending student application -> official PKS-STU serial assigned, preserved across active <-> inactive
  const stuApproveRes = store.updateMemberStatus(stuMemberObj.id, 'active');
  assert(stuApproveRes.success && stuApproveRes.membershipId, 'Super Admin can approve pending student application');
  assertEqual(
    stuApproveRes.membershipId.startsWith('PKS-STU-'),
    true,
    'Approved student member receives official PKS-STU serial'
  );
  const stuInactRes = store.updateMemberStatus(stuMemberObj.id, 'inactive');
  assertEqual(stuInactRes.success, true, 'Approved student member can be toggled inactive');
  assertEqual(stuInactRes.membershipId, stuApproveRes.membershipId, 'Toggling inactive preserves official serial');
  const stuReactRes = store.updateMemberStatus(stuMemberObj.id, 'active');
  assertEqual(stuReactRes.membershipId, stuApproveRes.membershipId, 'Reactivating preserves official serial');

  const fundBeforeDeleteTests = roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0));

  const pendingTxn = store.addTransaction({
    voucherNo: 'V-PEND-DEL-01',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 750,
    category: 'সদস্য ফি',
    donorOrPayee: 'টেস্ট দাতা',
    description: 'Pending delete test',
    autoApprove: false,
  });
  assert(pendingTxn.success && pendingTxn.transaction, 'Pending txn created for deletion test');

  // Cannot delete approved txn directly
  const approvedTxnForVoid = store.addTransaction({
    voucherNo: 'V-VOID-TEST-01',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 2000,
    category: 'বিশেষ অনুদান',
    donorOrPayee: 'দাতা ভয়েড',
    description: 'Will be voided to 0',
    autoApprove: true,
  });
  assert(approvedTxnForVoid.success && approvedTxnForVoid.transaction, 'Approved 2000 txn created');
  assertEqual(
    store.deleteTransaction(approvedTxnForVoid.transaction.id).success,
    false,
    'Direct delete on APPROVED transaction must be blocked'
  );

  // Can delete pending txn directly
  assertEqual(
    store.deleteTransaction(pendingTxn.transaction.id).success,
    true,
    'Super Admin can directly delete pending transaction'
  );

  // Void (৳0) approved transaction reverses its balance safely
  const voidRes = store.requestCorrection({
    originalTransactionId: approvedTxnForVoid.transaction.id,
    correctedAmount: 0,
    correctedCategory: approvedTxnForVoid.transaction.category,
    correctedFundId: approvedTxnForVoid.transaction.fundId,
    correctedAccountId: approvedTxnForVoid.transaction.accountId,
    correctedDonorOrPayee: approvedTxnForVoid.transaction.donorOrPayee,
    correctedDescription: 'ভয়েড/বাতিল পরীক্ষা',
    correctionReason: 'ভুল এন্ট্রি হওয়ায় পূর্ণ ৳০ রিভার্স করে বাতিল করা হলো',
  });
  assert(voidRes.success && voidRes.correction, `৳0 Reversal/Void must succeed: ${voidRes.error}`);
  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    fundBeforeDeleteTests,
    '৳0 Void reverses exact balance back cleanly'
  );

  // Backup validation still passes even with ৳0 voided transaction
  const backupAfterVoid = store.exportFullBackupJSON();
  assertEqual(
    store.validateBackupJSON(backupAfterVoid).isValid,
    true,
    'Backup validation allows ৳0 voided/reversed transactions'
  );

  // 8.5 Safe Fund Deletion & Archival
  assertEqual(
    store.deleteFund('fund-1').success,
    false,
    'Default fund (fund-1) with balance/history must NOT be deletable'
  );
  const addCustomFund = store.addFund({
    name: 'পরীক্ষামূলক তহবিল',
    code: 'TESTFUND99',
    description: 'Delete test fund',
    isActive: true,
    isDefault: false,
  });
  assertEqual(addCustomFund.success, true, 'Custom fund created');
  const customFund = store.funds.find((f) => f.code === 'TESTFUND99');
  assert(customFund, 'Custom fund exists');
  assertEqual(store.toggleFundActive(customFund.id).isActive, false, 'Custom fund can be archived/toggled inactive');
  assertEqual(store.deleteFund(customFund.id).success, true, 'Unused ৳0 custom fund can be safely deleted');

  // 8.6 Founders CRUD & Committee Deletion
  const founderAdded = store.addFounder({
    category: 'founding_member',
    nameBn: 'মোঃ প্রতিষ্ঠাতা সদস্য',
    nameEn: 'Founding Member Test',
    designationBn: 'প্রতিষ্ঠাতা সদস্য',
    priority: 10,
    isPublished: true,
  });
  assert(founderAdded.success && founderAdded.founder, 'Founder/Founding Member can be added');
  assertEqual(
    store.updateFounder(founderAdded.founder.id, { designationBn: 'সিনিয়র প্রতিষ্ঠাতা সদস্য' }).success,
    true,
    'Founder entry can be updated'
  );
  assertEqual(store.toggleFounderVisibility(founderAdded.founder.id), false, 'Founder visibility toggles cleanly');
  assertEqual(store.deleteFounder(founderAdded.founder.id).success, true, 'Founder entry can be deleted');

  const commCreated = store.addCommitteeTerm({
    title: 'টেস্ট কমিটি ২০২৬',
    wing: 'central',
    startYear: 2026,
    endYear: 2028,
    isCurrent: false,
    positions: [],
  });
  assert(commCreated.success && commCreated.term, 'Committee term created');
  assertEqual(
    store.addCommitteePosition(commCreated.term.id, {
      title: 'সদস্য সচিব',
      memberNameBn: 'টেস্ট নাম',
      priority: 1,
      isPublished: true,
    }).success,
    true,
    'Committee position added'
  );
  const addedPos = store.committees.find((c) => c.id === commCreated.term!.id)?.positions[0];
  assert(addedPos, 'Added position exists');
  assertEqual(
    store.deleteCommitteePosition(commCreated.term.id, addedPos.id).success,
    true,
    'Committee position can be deleted'
  );
  assertEqual(store.deleteCommitteeTerm(commCreated.term.id).success, true, 'Committee term can be deleted');

  // 8.7 Technical Partner 2 mobile numbers configurable anytime
  assertEqual(store.settings.technicalPartnerPhone1, '01717850780', 'Default tech partner phone 1');
  assertEqual(store.settings.technicalPartnerPhone2, '01603526000', 'Default tech partner phone 2');
  assertEqual(
    store.updateSettings({
      technicalPartnerPhone1: '01711111111',
      technicalPartnerPhone2: '01822222222',
    }).success,
    true,
    'Super Admin can update technical partner mobile numbers anytime'
  );
  assertEqual(store.settings.technicalPartnerPhone1, '01711111111', 'Updated tech partner phone 1 saved');
  assertEqual(store.settings.technicalPartnerPhone2, '01822222222', 'Updated tech partner phone 2 saved');

  // 8.8 White-Label Controls: Student Wing Toggle, 6 Theme Presets, Hero Banner URL
  assertEqual(store.settings.enableStudentWing, true, 'Default enableStudentWing is true');
  assertEqual(store.settings.themePreset, 'emerald_gold', 'Default themePreset is emerald_gold');
  assertEqual(store.settings.heroImageUrl, '', 'Default heroImageUrl is empty string');

  assertEqual(
    store.updateSettings({
      enableStudentWing: false,
      studentWingNameBn: 'কাস্টম ছাত্র কল্যাণ উইং',
      themePreset: 'royal_blue',
      heroImageUrl: 'https://example.com/custom-banner.jpg',
    }).success,
    true,
    'Super Admin can toggle enableStudentWing=false, change themePreset, and set heroImageUrl'
  );
  assertEqual(store.settings.enableStudentWing, false, 'enableStudentWing updated to false');
  assertEqual(store.settings.studentWingNameBn, 'কাস্টম ছাত্র কল্যাণ উইং', 'studentWingNameBn saved');
  assertEqual(store.settings.themePreset, 'royal_blue', 'themePreset updated to royal_blue');
  assertEqual(store.settings.heroImageUrl, 'https://example.com/custom-banner.jpg', 'heroImageUrl saved');

  // Verify legacy backup missing new white-label fields restores safe defaults
  const legacyBackupObj = JSON.parse(store.exportFullBackupJSON());
  delete legacyBackupObj.data.settings.enableStudentWing;
  delete legacyBackupObj.data.settings.themePreset;
  delete legacyBackupObj.data.settings.heroImageUrl;
  assertEqual(
    store.restoreFromBackupJSON(JSON.stringify(legacyBackupObj)).success,
    true,
    'Legacy backup without new white-label fields restores cleanly'
  );
  assertEqual(store.settings.enableStudentWing, true, 'Restored legacy settings defaults enableStudentWing to true');
  assertEqual(store.settings.themePreset, 'emerald_gold', 'Restored legacy settings defaults themePreset to emerald_gold');
  assertEqual(store.settings.heroImageUrl, '', 'Restored legacy settings defaults heroImageUrl to empty string');

  // 8.9 Advisory Council Wing & Safe Test Officer Deletion Guards
  const advCreated = store.addCommitteeTerm({
    title: 'উপদেষ্টা পরিষদ ২০২৬–২০২৮',
    wing: 'advisory',
    startYear: 2026,
    endYear: 2028,
    isCurrent: true,
    positions: [],
  });
  assert(advCreated.success && advCreated.term, 'Advisory council term can be created');
  assertEqual(
    store.addCommitteePosition(advCreated.term.id, {
      title: 'প্রধান উপদেষ্টা',
      memberNameBn: 'জনাব উপদেষ্টা মহোদয়',
      priority: 1,
      isPublished: true,
    }).success,
    true,
    'Advisory council position can be added and published'
  );
  assertEqual(
    store.committees.filter((c) => c.wing === 'advisory').length >= 1,
    true,
    'Advisory council appears under wing === advisory'
  );
  assertEqual(store.deleteCommitteeTerm(advCreated.term.id).success, true, 'Advisory term cleanup succeeds');

  const superSelfAccount = store.adminAccounts.find((a) => a.role === 'super_admin');
  assert(superSelfAccount, 'Super Admin account exists');
  assertEqual(
    store.deleteAdminAccount(superSelfAccount.id).success,
    false,
    'Super Admin account must NEVER be deletable'
  );
  assertEqual(
    store.deleteAdminAccount(genAdminAcc.id).success,
    true,
    'Non-super-admin test officer account can be safely deleted'
  );

  // ====================================================================
  // STEP 9: EVENT & PARTICIPATION MODULE ("অনুষ্ঠান ও আয়োজন")
  // ====================================================================
  console.log('\n--- STEP 9: Event & Participation Module & Fund Isolation ---');

  const mainFundsBeforeEvents = roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0));
  const mainAccsBeforeEvents = roundBDT(store.accounts.reduce((s, a) => s + a.currentBalance, 0));

  const evCreated = store.addEvent({
    title: 'বার্ষিক পুনর্মিলনী ও মিলনমেলা ২০২৬',
    eventType: 'reunion',
    summary: 'রংপুরবাসী পাটগ্রামবাসীর মিলনমেলা',
    description: 'বিস্তারিত বিবরণ',
    venue: 'রংপুর টাউন হল',
    eventDate: '2026-12-20 10:00',
    status: 'upcoming',
    isPublished: true,
    registrationOpen: true,
    allowPayLater: true,
    showParticipantCount: true,
    paymentInstructions: 'বিকাশ বা অনুষ্ঠানস্থলে নগদ',
  });
  assert(evCreated.success && evCreated.event, 'Super Admin creates Event cleanly');
  const evtId = evCreated.event.id;

  const catGen = store.addEventCategory({
    eventId: evtId,
    titleBn: 'সাধারণ সদস্য',
    descriptionBn: 'দুপুরের খাবারসহ',
    feeAmount: 500,
    maxQtyPerApplication: 10,
    priority: 1,
    isActive: true,
  });
  const catStu = store.addEventCategory({
    eventId: evtId,
    titleBn: 'শিক্ষার্থী',
    descriptionBn: 'ছাত্র কনসেশন',
    feeAmount: 250,
    maxQtyPerApplication: 10,
    priority: 2,
    isActive: true,
  });
  const catKid = store.addEventCategory({
    eventId: evtId,
    titleBn: '৫ বছরের নিচে শিশু',
    descriptionBn: 'বিনামূল্যে',
    feeAmount: 0,
    maxQtyPerApplication: 5,
    priority: 3,
    isActive: true,
  });
  assert(catGen.success && catGen.category && catStu.success && catStu.category && catKid.success && catKid.category, 'Event categories created');

  // 9.1 Attendance-first Pay-Later registration (2 general + 1 child = 3 participants, ৳1000)
  const payLaterApp = await store.submitPublicEventApplication({
    eventId: evtId,
    applicantNameBn: 'মোঃ করিম উদ্দিন',
    phone: '01710000111',
    organizationOrAddress: 'ধাপ, রংপুর',
    quantities: [
      { categoryId: catGen.category.id, quantity: 2 },
      { categoryId: catKid.category.id, quantity: 1 },
    ],
    paymentChoice: 'pay_later',
  });
  assert(payLaterApp.success && payLaterApp.application, 'Pay-later attendance-first application accepted');
  assertEqual(payLaterApp.application.totalParticipants, 3, 'Pay-later calculates 3 total participants');
  assertEqual(payLaterApp.application.totalFee, 1000, 'Pay-later calculates ৳1000 expected fee');
  assertEqual(payLaterApp.application.paymentStatus, 'unpaid', 'Pay-later marks paymentStatus as unpaid');

  // 9.2 Immediate bKash registration (2 students = ৳500)
  const payNowApp = await store.submitPublicEventApplication({
    eventId: evtId,
    applicantNameBn: 'মোঃ সাইফুল ইসলাম',
    phone: '01720000222',
    quantities: [{ categoryId: catStu.category.id, quantity: 2 }],
    paymentChoice: 'pay_now',
    paymentMethod: 'bkash',
    transactionId: 'TRX-EVT-101',
  });
  assert(payNowApp.success && payNowApp.application, 'Pay-now application with TxnID accepted');
  assertEqual(payNowApp.application.paymentStatus, 'submitted', 'Pay-now marks paymentStatus as submitted');

  // Duplicate TxnID block
  const dupTxnApp = await store.submitPublicEventApplication({
    eventId: evtId,
    applicantNameBn: 'ডুপ্লিকেট আবেদন',
    phone: '01730000333',
    quantities: [{ categoryId: catStu.category.id, quantity: 1 }],
    paymentChoice: 'pay_now',
    paymentMethod: 'bkash',
    transactionId: 'TRX-EVT-101',
  });
  assertEqual(dupTxnApp.success, false, 'Duplicate non-empty Event Transaction ID must be blocked');

  // Free ৳0 registration
  const freeApp = await store.submitPublicEventApplication({
    eventId: evtId,
    applicantNameBn: 'অতিথি অভিভাবক',
    phone: '01740000444',
    quantities: [{ categoryId: catKid.category.id, quantity: 2 }],
  });
  assert(freeApp.success && freeApp.application, '৳0 Free registration succeeds');
  assertEqual(freeApp.application.totalFee, 0, '৳0 totalFee');
  assertEqual(freeApp.application.paymentStatus, 'exempt', '৳0 paymentStatus becomes exempt');

  // 9.3 Category edit preserves previous frozen fee snapshots
  assertEqual(store.updateEventCategory(catGen.category.id, { feeAmount: 700 }).success, true, 'Category fee updated 500->700');
  const frozenApp = store.eventApplications.find((a) => a.id === payLaterApp.application!.id);
  assertEqual(frozenApp?.totalFee, 1000, 'Existing application frozen totalFee stays ৳1000 after category edit');

  // 9.4 Attendance approval vs Payment verification separation
  assertEqual(
    store.updateEventApplicationStatus(payLaterApp.application.id, 'approved').success,
    true,
    'Attendance status updated to approved'
  );
  assertEqual(
    store.eventApplications.find((a) => a.id === payLaterApp.application!.id)?.paymentStatus,
    'unpaid',
    'Approving attendance does NOT prematurely verify unpaid fee'
  );

  assertEqual(
    store.verifyOrRecordEventPayment({
      appId: payLaterApp.application.id,
      action: 'record_and_verify',
      paymentMethod: 'cash',
      paidAmount: 1000,
    }).success,
    true,
    'Admin records delayed cash payment and verifies ৳1000'
  );
  assertEqual(
    store.verifyOrRecordEventPayment({
      appId: payNowApp.application.id,
      action: 'verify',
    }).success,
    true,
    'Admin verifies submitted bKash ৳500'
  );

  // 9.5 Spot registration (uses new ৳700 price, cash verified)
  const spotRes = store.addSpotEventApplication({
    eventId: evtId,
    applicantNameBn: 'ওয়াক-ইন অতিথি',
    phone: '01750000555',
    quantities: [{ categoryId: catGen.category.id, quantity: 1 }],
    paymentStatus: 'verified',
    paymentMethod: 'cash',
  });
  assert(spotRes.success && spotRes.application, 'Spot walk-in registration succeeds');
  assertEqual(spotRes.application.paidAmount, 700, 'Spot registration uses updated ৳700 fee');

  // 9.6 Dedicated Event Ledger (Donor +2000, Expense -800) & Direct Refund (-500 without Finance Approver)
  assertEqual(
    store.addEventLedgerEntry({
      eventId: evtId,
      entryType: 'donation',
      title: 'স্পন্সর অনুদান',
      category: 'ডোনার অনুদান',
      partyName: 'হাজী মিজান',
      paymentMethod: 'cash',
      amount: 2000,
    }).success,
    true,
    'Dedicated event donation +2000 saved'
  );
  assertEqual(
    store.addEventLedgerEntry({
      eventId: evtId,
      entryType: 'expense',
      title: 'সাউন্ড ও ভেন্যু ব্যয়',
      category: 'ভেন্যু',
      partyName: 'রংপুর সাউন্ড',
      paymentMethod: 'cash',
      amount: 800,
    }).success,
    true,
    'Dedicated event expense -800 saved'
  );

  // Refund payNowApp (৳500) directly — automatic deduction from event fund
  assertEqual(
    store.refundEventPayment(payNowApp.application.id, 'অনিবার্য কারণে উপস্থিত থাকতে পারেননি', 500).success,
    true,
    'Verified payment ৳500 refunded cleanly'
  );

  // 9.7 Verify all 16 Dashboard KPIs & Strict Fund Isolation
  const evStats = store.getEventDashboardStats(evtId);
  assertEqual(evStats.totalApplications, 4, '4 total applications');
  assertEqual(evStats.totalRegisteredParticipants, 8, '8 total registered participants (3+2+2+1)');
  assertEqual(evStats.grossVerifiedCollection, 2200, 'Gross verified collection = 1000 + 500 + 700 = 2200');
  assertEqual(evStats.refundedCount, 1, '1 refunded application');
  assertEqual(evStats.totalRefundedAmount, 500, 'Total refunded = 500');
  assertEqual(evStats.eventDonationsTotal, 2000, 'Event donations = 2000');
  assertEqual(evStats.eventExpensesTotal, 800, 'Event expenses = 800');
  assertEqual(
    evStats.eventNetFundBalance,
    2900,
    'Net Event Fund Balance = (2200 - 500 + 2000) - 800 = 2900'
  );

  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    mainFundsBeforeEvents,
    'Main association 7 funds remain 100% untouched by event transactions/refunds'
  );
  assertEqual(
    roundBDT(store.accounts.reduce((s, a) => s + a.currentBalance, 0)),
    mainAccsBeforeEvents,
    'Main association accounts remain 100% untouched by event transactions/refunds'
  );

  // 9.8 Public Registration Status Lookup
  const foundLookup = await store.lookupPublicEventRegistration(
    payLaterApp.registrationCode!,
    '01710000111'
  );
  assertEqual(foundLookup.found, true, 'Public lookup succeeds with exact code + phone');
  const wrongPhoneLookup = await store.lookupPublicEventRegistration(
    payLaterApp.registrationCode!,
    '01999999999'
  );
  assertEqual(wrongPhoneLookup.found, false, 'Public lookup rejects mismatched phone');

  // 9.9 Event Admin RBAC & enableEventsModule Toggle & Legacy Backup Restore
  await store.createOfficerBySuperAdmin({
    fullName: 'অনুষ্ঠান অ্যাডমিন টেস্ট',
    email: 'eventadmin@patgram.org',
    role: 'event_admin',
    password: 'Password123!',
  });
  const evAdminAcc = store.adminAccounts.find((a) => a.email === 'eventadmin@patgram.org');
  assert(evAdminAcc, 'event_admin account created');
  // Revoke delete test permission on event_admin role and verify guard
  const evAdminLogin = await store.loginAdminLocal('eventadmin@patgram.org', 'Password123!');
  assertEqual(
    evAdminLogin.success,
    true,
    'event_admin can log in'
  );
  assert(freeApp.application, 'freeApp.application exists');
  assertEqual(
    store.deleteEventApplication(freeApp.application.id).success,
    false,
    'event_admin cannot delete test data when can_event_delete_test_data is false'
  );

  // Switch back to Super Admin and test enableEventsModule + backup/restore + legacy compatibility
  const superBack = await store.loginAdminLocal('super@patgram.test', 'Password@123');
  assertEqual(superBack.success, true, 'Super Admin logs back in cleanly');
  assertEqual(store.updateSettings({ enableEventsModule: false }).success, true, 'enableEventsModule toggles OFF');
  assertEqual(store.settings.enableEventsModule, false, 'enableEventsModule saved as false');
  const eventBackupStr = store.exportFullBackupJSON();
  assertEqual(store.validateBackupJSON(eventBackupStr).isValid, true, 'Backup with events validates cleanly');
  const legacyEventBackupObj = JSON.parse(eventBackupStr);
  delete legacyEventBackupObj.data.settings.enableEventsModule;
  delete legacyEventBackupObj.data.events;
  assertEqual(
    store.restoreFromBackupJSON(JSON.stringify(legacyEventBackupObj)).success,
    true,
    'Legacy backup without event fields restores cleanly'
  );
  assertEqual(store.settings.enableEventsModule, true, 'Restored legacy settings defaults enableEventsModule to true');
  assertEqual(store.deleteAdminAccount(evAdminAcc.id).success, true, 'Test event_admin account cleaned up');

  // ====================================================================
  // STEP 10: PHASE-2 HARDENING & REGRESSION CHECKS
  // ====================================================================
  console.log('\n--- STEP 10: Phase-2 Bug Fix Regression Verification ---');
  const { toDateTimeLocalValue, toIsoTimestamp, formatEventDateBn } = await import('../src/utils/dateFormat.ts');

  // 10.1 Date conversion utilities round-trip cleanly
  const isoSample = toIsoTimestamp('2026-12-25T16:30');
  assert(isoSample.includes('T') && isoSample.endsWith('Z'), 'toIsoTimestamp produces valid UTC ISO string');
  assert(toDateTimeLocalValue(isoSample).length === 16, 'toDateTimeLocalValue converts ISO to YYYY-MM-DDTHH:MM');
  assert(formatEventDateBn(isoSample).length > 5, 'formatEventDateBn returns readable Bengali date');

  // 10.2 Event maxCapacity enforcement on Public & Spot entry + Sequential Code Monotonicity after Deletion
  const capEventRes = store.addEvent({
    title: 'ক্যাপাসিটি টেস্ট আয়োজন',
    eventType: 'seminar',
    summary: 'সর্বোচ্চ আসন ২ জন',
    description: 'Capacity limit verification',
    venue: 'অফিস',
    eventDate: isoSample,
    status: 'upcoming',
    isPublished: true,
    registrationOpen: true,
    allowPayLater: true,
    showParticipantCount: true,
    maxCapacity: 2,
    paymentInstructions: 'ফ্রি',
  });
  assert(capEventRes.success && capEventRes.event, 'Capacity test event created');
  const capEvId = capEventRes.event.id;
  const capCatRes = store.addEventCategory({
    eventId: capEvId,
    titleBn: 'সাধারণ',
    descriptionBn: '',
    feeAmount: 0,
    maxQtyPerApplication: 5,
    priority: 1,
    isActive: true,
  });
  assert(capCatRes.success && capCatRes.category, 'Capacity category created');

  const firstSeat = await store.submitPublicEventApplication({
    eventId: capEvId,
    applicantNameBn: 'অংশগ্রহণকারী ১',
    phone: '01770000111',
    quantities: [{ categoryId: capCatRes.category.id, quantity: 2 }],
  });
  assert(firstSeat.success, 'Registering up to exact maxCapacity (2/2) succeeds');

  const overCapPublic = await store.submitPublicEventApplication({
    eventId: capEvId,
    applicantNameBn: 'অতিরিক্ত পাবলিক',
    phone: '01770000222',
    quantities: [{ categoryId: capCatRes.category.id, quantity: 1 }],
  });
  assertEqual(overCapPublic.success, false, 'Public registration exceeding maxCapacity must be rejected');

  const overCapSpot = store.addSpotEventApplication({
    eventId: capEvId,
    applicantNameBn: 'অতিরিক্ত স্পট',
    phone: '01770000333',
    quantities: [{ categoryId: capCatRes.category.id, quantity: 1 }],
    paymentStatus: 'exempt',
  });
  assertEqual(overCapSpot.success, false, 'Spot registration exceeding maxCapacity must be rejected');

  // 10.3 Sequential code uniqueness after deletion (no collision with existing earlier code)
  const capEvCodeBeforeDel = capEventRes.event.code;
  const secondCapEv = store.addEvent({
    title: 'দ্বিতীয় ইভেন্ট কোড টেস্ট',
    eventType: 'general',
    summary: '',
    description: '',
    venue: 'রংপুর',
    eventDate: isoSample,
    status: 'upcoming',
    isPublished: false,
    registrationOpen: false,
    allowPayLater: true,
    showParticipantCount: true,
    paymentInstructions: '',
  });
  assert(secondCapEv.success && secondCapEv.event, 'Second event created');
  const secondCode = secondCapEv.event.code;
  assertEqual(store.deleteEvent(capEvId).success, true, 'First event deleted');
  const thirdCapEv = store.addEvent({
    title: 'তৃতীয় ইভেন্ট কোড টেস্ট',
    eventType: 'general',
    summary: '',
    description: '',
    venue: 'রংপুর',
    eventDate: isoSample,
    status: 'upcoming',
    isPublished: false,
    registrationOpen: false,
    allowPayLater: true,
    showParticipantCount: true,
    paymentInstructions: '',
  });
  assert(thirdCapEv.success && thirdCapEv.event, 'Third event created after deleting first');
  assert(
    thirdCapEv.event.code !== capEvCodeBeforeDel && thirdCapEv.event.code !== secondCode,
    'Event code after deletion never collides with existing codes'
  );
  store.deleteEvent(secondCapEv.event.id);
  store.deleteEvent(thirdCapEv.event.id);

  // 10.4 fund_transfer correction accurately adjusts source & destination fund/account balances
  const srcFund = store.funds[0];
  const dstFundA = store.funds[1];
  const dstFundB = store.funds[2];
  const srcAcc = store.accounts[0];
  assert(srcFund && dstFundA && dstFundB && srcAcc, 'Default funds and accounts exist for transfer test');

  // Seed enough balance on source fund & account for clean transfer test
  const seedIncomeRes = store.addTransaction({
    voucherNo: 'SEED-TRF-01',
    type: 'income',
    fundId: srcFund.id,
    accountId: srcAcc.id,
    amount: 2000,
    category: 'সদস্য অনুদান',
    donorOrPayee: 'টেস্ট ডোনার',
    description: 'ট্রান্সফার টেস্ট ব্যালেন্স সিড',
  });
  assert(seedIncomeRes.success && seedIncomeRes.transaction, 'Seed income created');
  if (seedIncomeRes.transaction.status === 'pending_approval') {
    assertEqual(store.approveTransaction(seedIncomeRes.transaction.id).success, true, 'Approve seed income');
  }

  const genFundBefore = roundBDT(store.funds.find((f) => f.id === srcFund.id)!.currentBalance);
  const stuFundBefore = roundBDT(store.funds.find((f) => f.id === dstFundA.id)!.currentBalance);
  const eduFundBefore = roundBDT(store.funds.find((f) => f.id === dstFundB.id)!.currentBalance);
  const bankAccBefore = roundBDT(store.accounts.find((a) => a.id === srcAcc.id)!.currentBalance);

  const transferTxnRes = store.addTransaction({
    voucherNo: 'TRF-TEST-01',
    type: 'fund_transfer',
    fundId: srcFund.id,
    accountId: srcAcc.id,
    toFundId: dstFundA.id,
    toAccountId: srcAcc.id,
    amount: 1000,
    category: 'তহবিল স্থানান্তর',
    donorOrPayee: 'অভ্যন্তরীণ স্থানান্তর',
    description: 'ফান্ড ট্রান্সফার টেস্ট',
  });
  assert(transferTxnRes.success && transferTxnRes.transaction, `Fund transfer transaction created (${transferTxnRes.error || ''})`);
  if (transferTxnRes.transaction.status === 'pending_approval') {
    assertEqual(store.approveTransaction(transferTxnRes.transaction.id).success, true, 'Approve fund transfer');
  }
  // Correct transfer destination from dstFundA to dstFundB and amount 1000 -> 1500
  const trfCorrRes = store.requestCorrection({
    originalTransactionId: transferTxnRes.transaction.id,
    correctedAmount: 1500,
    correctedCategory: 'তহবিল স্থানান্তর',
    correctedFundId: srcFund.id,
    correctedAccountId: srcAcc.id,
    correctedToFundId: dstFundB.id,
    correctedToAccountId: srcAcc.id,
    correctedDonorOrPayee: 'অভ্যন্তরীণ স্থানান্তর',
    correctedDescription: 'গন্তব্য ও পরিমাণ সংশোধন',
    correctionReason: 'ভুলবশত প্রথম তহবিলে পাঠানো হয়েছিল, সঠিক গন্তব্য তহবিলে স্থানান্তর প্রয়োজন',
  });
  assertEqual(trfCorrRes.success, true, `Super Admin fund_transfer correction succeeds (${trfCorrRes.error || ''})`);
  assertEqual(
    roundBDT(store.funds.find((f) => f.id === srcFund.id)!.currentBalance),
    roundBDT(genFundBefore - 1500),
    'Source fund updated to -1500'
  );
  assertEqual(
    roundBDT(store.funds.find((f) => f.id === dstFundA.id)!.currentBalance),
    stuFundBefore,
    'Previous destination fund restored cleanly'
  );
  assertEqual(
    roundBDT(store.funds.find((f) => f.id === dstFundB.id)!.currentBalance),
    roundBDT(eduFundBefore + 1500),
    'Corrected destination fund credited +1500'
  );
  assertEqual(
    roundBDT(store.accounts.find((a) => a.id === srcAcc.id)!.currentBalance),
    bankAccBefore,
    'Same-account transfer net cash stays balanced'
  );

  // 10.5 Role permission isolation check (user permission overrides do not mutate base rolePermissions)
  const baseFinManageSetting = Boolean(store.rolePermissions.finance_secretary.can_manage_settings);
  await store.createOfficerBySuperAdmin({
    fullName: 'ওভাররাইড টেস্ট কর্মকর্তা',
    email: 'override@patgram.test',
    role: 'finance_secretary',
    password: 'Password@123',
  });
  const ovAcc = store.adminAccounts.find((a) => a.email === 'override@patgram.test');
  assert(ovAcc, 'Override test officer exists');
  assertEqual(
    store.updateUserPermission(ovAcc.id, 'finance_secretary', 'can_manage_settings', !baseFinManageSetting).success,
    true,
    'Super Admin applies individual user permission override'
  );
  assertEqual(
    Boolean(store.userPermissions[ovAcc.id]?.can_manage_settings),
    !baseFinManageSetting,
    'User override stored cleanly in userPermissions map'
  );
  assertEqual(
    Boolean(store.rolePermissions.finance_secretary.can_manage_settings),
    baseFinManageSetting,
    'Officer custom userPermissions override never mutates rolePermissions base template'
  );
  store.deleteAdminAccount(ovAcc.id);

  console.log('\nALL AUDIT & FINANCIAL INTEGRITY TESTS PASSED SUCCESSFULLY!');
}

runAuditTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
