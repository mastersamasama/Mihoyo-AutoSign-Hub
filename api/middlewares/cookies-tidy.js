// hooks are invoked as (options, ctx) — see middlewareLoader.wrapMiddleware
function preCheckin(_options, ctx) {
    const users = ctx?.plugin_options?.users;
    if (Array.isArray(users)) {
        for (let user of users) {
            if (user?.cookies) {
                user.cookies = user.cookies.split(";").map((cookie) => cookie.trim()).join(";");
            }
        }
    }
}


export default {
    preCheckin,
}