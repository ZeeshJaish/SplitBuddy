# SplitBuddy CP3 check — Mradul

## Check
Check group membership from both demo accounts.

## Steps I ran
1. Started SplitBuddy using the provided PostgreSQL script.
2. Selected Dev and checked the group list.
3. Confirmed Weekend trip was initially not visible.
4. Switched to Asha and opened Weekend trip.
5. Used Add member to add Dev.
6. Reloaded and switched back to Dev.
7. Opened Weekend trip and checked the member list.

## What I observed
- Dev initially could not see Weekend trip.
- Asha successfully added Dev.
- After reload, Weekend trip appeared in Dev's account.
- Dev appeared in the member list.
- Dev's balance was ₹0.

## Code I traced
dbms/04_queries.sql · W2, R2 and R3

- W2: Adds a member to a group.
- R2: Lists groups belonging to a member.
- R3: Lists members of a group.

## Result
SplitBuddy group membership check passed.
