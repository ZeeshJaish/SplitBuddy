# SplitBuddy CP3 check — Himank

## Check
Check that custom shares must add up

## Steps I ran

This check ran on 19 November 2026 with a fresh PostgreSQL 18.6 database loaded from the demo fixture.

1. Started the app with `bash checks/with-postgres.sh bash checks/start-splitbuddy.sh`. Chose **Asha** and opened **Weekend trip**.
2. Clicked **Add expense**. Entered `Custom split check` and `100.00`. Chose **Custom** and selected only **Asha** and **Bina**.
3. Entered ₹60 for Asha and ₹30 for Bina and attempted to save. Recorded the validation error. Checked that **History** had no entry with the description `Custom split check`.
4. Changed Bina's share to ₹40 and saved.
5. Reloaded the page as Asha. Opened **Weekend trip** and verified the saved entry and each member's share.

## What I observed

The ₹60 and ₹30 attempt showed a validation error — the app refused to save because the shares did not add up to ₹100.00. History was unchanged; no row appeared with the description `Custom split check`.

After changing Bina's share to ₹40, the save succeeded. After reload, **Weekend trip** showed the new entry:

| Field | Value |
| --- | --- |
| Description | Custom split check |
| Total | ₹100.00 |
| Asha's share | ₹60.00 |
| Bina's share | ₹40.00 |

The shares summed to exactly ₹100.00. A direct read of the expense and share rows also confirmed 6000 and 4000 paise respectively.

## Code I traced

**dbms/04\_queries.sql · W4 and R6**

W4 saves a custom-split expense and its shares. Before inserting, it checks that the sum of all submitted share amounts equals the expense total. If the sum does not match, the statement writes zero rows and the API returns a validation error. For the ₹60/₹40 split the check passes and two share rows are inserted with the exact paise amounts.

R6 reads the stored shares for a given expense. The W4 query plan and R6 query plan in the separate three-run benchmark confirm the corresponding write and read paths. After the corrected save, R6 returned share_paise = 6000 for Asha and 4000 for Bina.
