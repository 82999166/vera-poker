import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // Allow admin_users session (dedicated admin table)
    if (ctx.adminUser && ["super_admin", "admin"].includes(ctx.adminUser.role)) {
      return next({ ctx: { ...ctx } });
    }

    // Fallback: allow game users with admin/super_admin role (Manus OAuth owners)
    if (ctx.user && ["admin", "super_admin"].includes(ctx.user.role)) {
      return next({ ctx: { ...ctx } });
    }

    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }),
);

// Staff procedure: allows any admin_users session role (admin, cs, finance, tech)
// Also allows game users with admin role as fallback
export const staffProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (ctx.adminUser) {
      return next({ ctx: { ...ctx } });
    }

    // Fallback: allow game users with admin role
    if (ctx.user && ["admin", "super_admin"].includes(ctx.user.role)) {
      return next({ ctx: { ...ctx } });
    }

    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }),
);
