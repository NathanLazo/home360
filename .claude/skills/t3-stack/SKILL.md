---
name: t3-stack
description: "Build full-stack TypeScript applications using T3 Stack (Next.js, tRPC, Prisma, Tailwind)."
---

# T3 Stack Development

## Overview
The T3 Stack is a full-stack TypeScript framework built on Next.js, tRPC, Prisma, and Tailwind CSS. It provides end-to-end type safety from database to frontend. This skill should be invoked when building type-safe full-stack applications that require rapid prototyping with full-stack type guarantees.

## Core Principles
- **End-to-End Types**: Share TypeScript types from backend to frontend automatically
- **API as Function**: tRPC enables calling backend functions as if they were local
- **Convention over Configuration**: opinionated setup for productivity
- **Database First**: Define schema in Prisma, generate types automatically

## Preparation Checklist
- [ ] Install create-t3-app: `npm create t3-app@latest`
- [ ] Choose providers during setup (NextAuth, Prisma, Tailwind)
- [ ] Design database schema before implementation
- [ ] Plan tRPC router structure

## Step-by-Step Process
1. **Initialize**: Run `npm create t3-app@latest` with desired options
2. **Define Schema**: Create Prisma schema with models
3. **Run Migration**: Generate database with `prisma db push`
4. **Create Routers**: Build tRPC routers with procedures
5. **Build UI**: Create Next.js pages using tRPC hooks
6. **Style**: Use Tailwind CSS for responsive design
7. **Deploy**: Push to Vercel with environment variables

## Do's and Don'ts
- ✅ **Do** use tRPC procedures for type-safe API calls
- ✅ **Do** leverage Prisma's type safety with generated types
- ✅ **Do** use Next.js App Router for new projects
- ❌ **Don't** skip validation - use Zod with tRPC
- ❌ **Don't** mix App Router and Pages Router in same project
- ❌ **Don't** ignore environment variable configuration

## Anti-Patterns
- **No Validation**: Skipping Zod schemas in tRPC procedures
- **Direct DB Access**: Accessing Prisma directly in components instead of tRPC
- **Ignored Types**: Not leveraging the full type chain
- **Over-customization**: Adding too many custom configs that break conventions
