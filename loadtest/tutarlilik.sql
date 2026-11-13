\pset format unaligned
\pset tuples_only on
SELECT '- Son bir saatte aynı kişiye birden fazla giriş kaydı: ' || count(*) || ' kişi'
FROM (SELECT "UserId" FROM "AttendanceEvents" WHERE "Type" = 'CheckIn' AND "OccurredAt" > now() - interval '1 hour'
      GROUP BY "UserId" HAVING count(*) > 1) x;
SELECT '- Çift okutma denemesinde kaydedilen giriş: ' || count(*) || ' (doğrusu 100)'
FROM "AttendanceEvents" e JOIN "Users" u ON u."Id" = e."UserId"
WHERE u."Email" LIKE 'lt-cift-%' AND e."OccurredAt" > now() - interval '1 hour';
SELECT '- Gönderilen anlık uyarı (gelmedi / mola aşımı): ' || count(*) FROM "AttendanceAlerts";
SELECT '- Müdürlere giden bildirim: ' || count(*) FROM "Notifications" WHERE "Type" IN ('EmployeeNotArrived', 'BreakOverrun');
