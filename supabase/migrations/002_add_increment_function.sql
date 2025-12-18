-- Function to increment a column value
CREATE OR REPLACE FUNCTION increment(
  table_name text,
  column_name text,
  row_id uuid
)
RETURNS void AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = %I + 1 WHERE id = $1',
    table_name,
    column_name,
    column_name
  ) USING row_id;
END;
$$ LANGUAGE plpgsql;

