-- Yük testi verisi: demo firmaya 10 şube, her şubede 1 müdür, 1 kiosk ve 200 personel;
-- ayrıca "çift okutma" denemesi için 100 personel. Herkesin şifresi demo şifresiyle aynı (Pdks123!).
-- Geçmiş 20 iş günü için giriş-çıkış kayıtları ve bugün için yayınlanmış vardiya eklenir (raporlar ve uyarılar dolu çalışsın).
-- Satırlar demo kayıtlardan kopyalanır; böylece tablo yapısı değişse de betik çalışır.
DO $$
DECLARE
  emp "Users"%ROWTYPE;
  mgr "Users"%ROWTYPE;
  kuser "Users"%ROWTYPE;
  br "Branches"%ROWTYPE;
  ki "Kiosks"%ROWTYPE;
  admin_id uuid;
  b int;
  i int;
  branch_id uuid;
  kiosk_user_id uuid;
  local_now timestamp := now() AT TIME ZONE 'Europe/Istanbul';
  today date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  week_start date := today - ((extract(isodow FROM today)::int) - 1);
  shift_start time := date_trunc('minute', local_now)::time - interval '30 minutes';
BEGIN
  SELECT * INTO emp FROM "Users" WHERE "Email" = 'personel@pdks.local';
  SELECT * INTO mgr FROM "Users" WHERE "Email" = 'mudur@pdks.local';
  SELECT * INTO kuser FROM "Users" WHERE "Email" = 'kiosk@pdks.local';
  SELECT "Id" INTO admin_id FROM "Users" WHERE "Email" = 'admin@pdks.local';
  SELECT * INTO br FROM "Branches" WHERE "Id" = emp."BranchId";
  SELECT * INTO ki FROM "Kiosks" WHERE "DeviceUserId" = kuser."Id";

  -- Gece yarısına yakın çalışırsa vardiya saatleri dönmesin
  IF shift_start > time '14:00' THEN shift_start := time '14:00'; END IF;

  FOR b IN 1..10 LOOP
    branch_id := gen_random_uuid();
    br."Id" := branch_id; br."Name" := 'Yük Şube ' || b;
    INSERT INTO "Branches" SELECT (br).*;

    mgr."Id" := gen_random_uuid(); mgr."Email" := 'lt-mudur-' || b || '@yuk.test'; mgr."BranchId" := branch_id;
    mgr."LastName" := 'Müdür ' || b;
    INSERT INTO "Users" SELECT (mgr).*;

    kiosk_user_id := gen_random_uuid();
    kuser."Id" := kiosk_user_id; kuser."Email" := 'lt-kiosk-' || b || '@yuk.test'; kuser."BranchId" := branch_id;
    INSERT INTO "Users" SELECT (kuser).*;
    ki."Id" := gen_random_uuid(); ki."BranchId" := branch_id; ki."DeviceUserId" := kiosk_user_id; ki."Name" := 'Yük Kiosk ' || b;
    ki."Secret" := encode(decode(md5(random()::text) || md5(random()::text), 'hex'), 'base64');
    INSERT INTO "Kiosks" SELECT (ki).*;

    FOR i IN 1..200 LOOP
      emp."Id" := gen_random_uuid(); emp."Email" := 'lt-' || b || '-' || i || '@yuk.test'; emp."BranchId" := branch_id;
      emp."FirstName" := 'Yük'; emp."LastName" := 'Personel ' || b || '-' || i;
      INSERT INTO "Users" SELECT (emp).*;
    END LOOP;

    INSERT INTO "ShiftWeeks" ("Id", "CompanyId", "BranchId", "WeekStart", "PublishedAt", "PublishedByUserId", "CreatedAt")
    VALUES (gen_random_uuid(), br."CompanyId", branch_id, week_start, now(), admin_id, now());
  END LOOP;

  -- Çift okutma denemesi için ayrı personel (1. yük şubesinde)
  SELECT "Id" INTO branch_id FROM "Branches" WHERE "Name" = 'Yük Şube 1';
  FOR i IN 1..100 LOOP
    emp."Id" := gen_random_uuid(); emp."Email" := 'lt-cift-' || i || '@yuk.test'; emp."BranchId" := branch_id;
    emp."FirstName" := 'Çift'; emp."LastName" := 'Okutma ' || i;
    INSERT INTO "Users" SELECT (emp).*;
  END LOOP;

  -- Bugün için vardiya: 30 dk önce başladı (gelmeyenler için anlık uyarı tetiklenir)
  INSERT INTO "Shifts" ("Id", "CompanyId", "BranchId", "UserId", "Date", "Kind", "StartTime", "EndTime", "CreatedByUserId", "CreatedAt")
  SELECT gen_random_uuid(), u."CompanyId", u."BranchId", u."Id", today, 'Work', shift_start, shift_start + interval '9 hours', admin_id, now()
  FROM "Users" u WHERE u."Email" LIKE 'lt-%-%@yuk.test' AND u."Email" NOT LIKE 'lt-mudur-%' AND u."Email" NOT LIKE 'lt-kiosk-%';

  -- Geçmiş 20 iş günü: giriş, mola, çıkış (pazar hariç)
  INSERT INTO "AttendanceEvents" ("Id", "CompanyId", "BranchId", "UserId", "Type", "OccurredAt", "Source", "CreatedAt")
  SELECT gen_random_uuid(), u."CompanyId", u."BranchId", u."Id", e.type,
         ((d.day + e.at + (random() * interval '20 minutes')) AT TIME ZONE 'Europe/Istanbul'), 'QrScan', now()
  FROM "Users" u
  CROSS JOIN LATERAL (SELECT today - g AS day FROM generate_series(1, 24) g) d
  CROSS JOIN (VALUES ('CheckIn', time '07:50'), ('BreakStart', time '12:00'), ('BreakEnd', time '12:50'), ('CheckOut', time '17:30')) e(type, at)
  WHERE u."Email" LIKE 'lt-%-%@yuk.test' AND u."Email" NOT LIKE 'lt-mudur-%' AND u."Email" NOT LIKE 'lt-kiosk-%' AND u."Email" NOT LIKE 'lt-cift-%'
    AND extract(isodow FROM d.day) <> 7;
END $$;

SELECT 'personel' AS tur, count(*) FROM "Users" WHERE "Email" LIKE 'lt-%@yuk.test' AND "Role" = 'Employee'
UNION ALL SELECT 'gecmis kayit', count(*) FROM "AttendanceEvents"
UNION ALL SELECT 'vardiya', count(*) FROM "Shifts";
