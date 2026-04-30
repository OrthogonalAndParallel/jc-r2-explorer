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

	const url = new URL(c.req.url);
	const basePath = c.env.BASE_PATH || "";

	// Strip base path prefix if configured
	let pathname = url.pathname;
	if (basePath && pathname.startsWith(basePath)) {
		pathname = pathname.slice(basePath.length) || "/";
	}

	if (!pathname.includes(".")) {
		// For SPA routes, fetch from ASSETS with stripped path
		const assetUrl = new URL(pathname, url.origin);
		return c.env.ASSETS.fetch(new Request(assetUrl));
	}

	await next();
}
