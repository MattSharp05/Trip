-- TR-54 fix on top of 0054_realtime.sql (applied, so not edited): Realtime doesn't apply RLS to
-- delete events, so anyone subscribed with a trip's id heard its rows' deletes (primary keys
-- only), members or not. The publication now carries inserts and updates only; a delete reaches
-- members through the trip's touched `trips` row (`<table>_touch_trip`), which RLS does guard.
alter publication supabase_realtime set (publish = 'insert, update');
