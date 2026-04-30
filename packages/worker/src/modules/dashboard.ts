import type { AppContext } from "../types";

export function dashboardIndex(c: AppContext) {
	if (c.env.ASSETS === undefined) {
		return c.text(
			"ASSETS binding is not defined, learn more here: https://r2explorer.com/guides/migrating-to-1.1/",
			500,
		);
	}

	return c.text(
		"ASSETS binding is not pointing to a valid dashboard, learn more here: https://r2explorer.com/guides/migrating-to-1.1/",
		500,
	);
}

export async function dashboardRedirect(c: AppContext, next) {
	if (c.env.ASSETS === undefined) {
		return c.text(
			"ASSETS binding is not defined, learn more here: https://r2explorer.com/guides/migrating-to-1.1/",
			500,
		);
	}

	// API and share routes are handled by other routes in index.ts
	const url = new URL(c.req.url);
	if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/share/")) {
		await next();
		return;
	}

	// All other requests fetch from ASSETS
	return c.env.ASSETS.fetch(c.req.raw);
}
