# PEPTIVANTA Sales CRM — UI MVP

A lightweight sales CRM workspace designed for PEPTIVANTA's lead qualification, quotation, follow-up, payment, fulfillment and repeat-purchase workflow.

## UI references used as design principles

- Close CRM: action-first Inbox / daily task queue and lead context.
- Pipedrive: visual deal pipeline, drag-and-drop stages, next-activity urgency.
- HubSpot Sales Workspace: dashboard KPIs and dense object tables.
- Zoho CRM: stage context and detail/timeline organization.

The interface is original and does not copy assets or source code from those products.

## Current MVP

- Dashboard with daily queue and KPI cards
- Lead/customer table with filters and global search
- Drag-and-drop pipeline
- Follow-up tasks with overdue/today/future priority
- Customer detail drawer with overview, timeline and orders
- Order / margin overview
- Source, market and product-demand reports
- Add-customer modal
- Browser-local persistence with JSON export
- Responsive desktop/mobile layout

## Data note

This UI MVP intentionally stores demo/customer records in browser `localStorage` only. It does not commit customer data to GitHub.

For production, connect the front end to Cloudflare D1 (or another database) and protect the application with Cloudflare Access or a proper authentication layer.

## Cloudflare Pages deployment

Recommended setup for a separate CRM Pages project:

- Repository: `espinosacenterfold-rgb/peptivanta-biosciences`
- Production branch: `crm-dashboard`
- Root directory: leave blank
- Build command: leave blank
- Build output directory: `crm`
- Recommended custom domain: `crm.peptivanta.com`

No Node build is required for the UI MVP.
