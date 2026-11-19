INSERT INTO splitbuddy.users (user_id, display_name, email) VALUES
    (1, 'Asha', 'asha@example.test'),
    (2, 'Bina', 'bina@example.test'),
    (3, 'Chetan', 'chetan@example.test'),
    (4, 'Dev', 'dev@example.test');
SELECT setval(pg_get_serial_sequence('splitbuddy.users', 'user_id'), 4);

EXECUTE splitbuddy_create_group(1, 'Weekend trip');
EXECUTE splitbuddy_add_member(
    currval(pg_get_serial_sequence('splitbuddy.expense_groups', 'group_id')), 1, 2
);
EXECUTE splitbuddy_add_member(
    currval(pg_get_serial_sequence('splitbuddy.expense_groups', 'group_id')), 1, 3
);
EXECUTE splitbuddy_record_equal_expense(
    currval(pg_get_serial_sequence('splitbuddy.expense_groups', 'group_id')),
    1, 'Dinner', 90000, ARRAY[1, 2, 3]::bigint[]
);
EXECUTE splitbuddy_record_settlement(
    currval(pg_get_serial_sequence('splitbuddy.expense_groups', 'group_id')), 2, 1, 30000
);
