-- Supabase Realtime otomatis kirim event ke client yang subscribe
-- setiap kali row di grid_status berubah, tidak perlu kode broadcast manual.
ALTER PUBLICATION supabase_realtime ADD TABLE grid_status;
