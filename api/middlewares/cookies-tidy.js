function preCheckin(ctx) {
    if (ctx.plugin_options?.users?.cookies) {
        for (let user of ctx.plugin_options.users) {
            user.cookies = user.cookies.split(";").map((cookie) => cookie.trim()).join(";");
        }
    }
    console.log("preCheckin", ctx.plugin_options);
}


export default {
    preCheckin,
}