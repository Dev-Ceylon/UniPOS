## What

## Why

## Checklist

- [ ] Money stays in integer minor units
- [ ] Every new action/route checks a permission with `can()` and validates input with Zod
- [ ] New tenant tables have `tenantId` + RLS policy
- [ ] Sensitive actions write the audit log
- [ ] Tests added (unit for core logic, integration for DB, E2E for flows)
