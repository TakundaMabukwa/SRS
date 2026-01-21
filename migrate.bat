@echo off
echo Installing PostgreSQL tools...
winget install --id PostgreSQL.PostgreSQL -e --silent

echo.
echo Waiting for installation...
timeout /t 10

echo.
echo Adding PostgreSQL to PATH...
set PATH=%PATH%;C:\Program Files\PostgreSQL\17\bin;C:\Program Files\PostgreSQL\16\bin;C:\Program Files\PostgreSQL\15\bin

echo.
echo Dumping schema from eps...
pg_dump "postgresql://postgres:SjtqveldMeBar0Ld@db.ihegfiqnobewpwcewrae.supabase.co:5432/postgres" --schema-only --schema=public --no-owner --no-acl -f eps_schema.sql

echo.
echo Restoring schema to Premier Cross Border...
psql "postgresql://postgres:dq6DATu9VlZF4pCL@db.kxtykpuxlsvrwcaumuqm.supabase.co:5432/postgres" -f eps_schema.sql

echo.
echo Done!
pause
