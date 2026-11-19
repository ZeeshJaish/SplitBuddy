# SplitBuddy CP3 check — Sujay

## Check
Check a ₹50 repayment

## Steps I ran
1. Created an isolated group with Asha, Bina, and Chetan, then recorded a ₹900 equal-split dinner paid by Asha.
2. Recorded Bina’s ₹300 repayment to Asha, leaving Asha at ₹300 and Chetan at −₹300.
3. Switched to Chetan, recorded a ₹50 repayment to Asha, then reloaded and reopened the group.

The pre-existing Weekend trip group already contained an extra ₹50 repayment from Asha to Chetan, so I used the isolated group for a clean starting balance without changing that existing history.

## What I observed
Before Chetan’s repayment, Asha’s balance was ₹300.00 (receives) and Chetan’s was −₹300.00 (owes). After saving the ₹50.00 repayment, Asha’s balance was ₹250.00 and Chetan’s was −₹250.00. After reload, History still showed “Repayment ₹50.00 Chetan paid Asha,” and the balances remained ₹250.00 and −₹250.00. Bina remained settled at ₹0.00.

## Code I traced
`dbms/04_queries.sql` W5 inserts a settlement with Chetan as `from_user_id`, Asha as `to_user_id`, and the amount in paise. R4 adds the settlement amount to the sender’s balance and subtracts it from the recipient’s balance, moving Chetan from −₹300.00 to −₹250.00 and Asha from ₹300.00 to ₹250.00. R5 includes settlements in History with the sender, recipient, and amount, which is why the repayment remains visible after reload.
