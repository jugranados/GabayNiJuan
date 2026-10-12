-- Gabay ni Juan — let signed-in staff run the editorial record functions
--
-- editorial_update() and editorial_transition() are SECURITY INVOKER on purpose: they run
-- with the caller's rights, so Row Level Security and every trigger still apply. They call
-- private.assert_editorial_table(), which calls private.editorial_tables(). Earlier
-- migrations revoked EXECUTE on every function in `private` and granted back only the role
-- helpers, so every save and every workflow transition failed for every editor with
-- "permission denied for function assert_editorial_table".
--
-- Both helpers only answer "is this one of the editable table names?". They read no data and
-- change nothing, so granting them reveals nothing a staff member cannot already see. `anon`
-- is not granted: the editorial functions themselves are not executable by anon.
--
-- Trigger functions in `private` need no grant: a trigger runs regardless of the caller's
-- EXECUTE privilege, and the SECURITY DEFINER ones call their helpers as the owner.

grant execute on function private.editorial_tables() to authenticated;
grant execute on function private.assert_editorial_table(text) to authenticated;
