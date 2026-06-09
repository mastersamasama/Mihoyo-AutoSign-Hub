const i18n = {
  en: {
    status: {
      success: "✅ Success",
      partial: "⚠️ Partial Success",
      failed: "❌ Failed",
      error: "🔥 System Error",
    },
    titles: {
      checkin_results: "Check-in Results (Users: ${count})",
      plugin_info: "🔌 Plugin Info",
      execution_time: "⏱️ Execution Time",
      error_details: "Error Details",
      retry_advice: "Troubleshooting Advice",
    },
    messages: {
      already_claimed: "Already claimed",
      cookie_expired: "Cookie expired",
      activity_ended: "Event has ended",
      too_frequent: "Too frequent check-in",
    },
    info: {
      plugin_name: "**Name**: ${name}",
      plugin_version: "**Version**: ${version}",
      plugin_date: "**Last Update**: ${date}",
      plugin_author: "**Author**: ${author}",
      plugin_contact: "**Contact**: ${contact}",
    },
  },
  "zh-cn": {
    status: {
      success: "✅ 签到成功",
      partial: "⚠️ 部分成功",
      failed: "❌ 签到失败",
      error: "🔥 系统错误",
    },
    titles: {
      checkin_results: "签到结果 (用户数: ${count})",
      plugin_info: "🔌 插件信息",
      execution_time: "⏱️ 执行耗时",
      error_details: "错误详情",
      retry_advice: "故障排查建议",
    },
    messages: {
      already_claimed: "重复签到",
      cookie_expired: "Cookie 失效",
      activity_ended: "活动已结束",
      too_frequent: "签到过于频繁",
    },
    info: {
      plugin_name: "**插件名称**: ${name}",
      plugin_version: "**插件版本**: ${version}",
      plugin_date: "**最后更新日期**: ${date}",
      plugin_author: "**插件作者**: ${author}",
      plugin_contact: "**联系方式**: ${contact}",
    },
  },
  "zh-tw": {
    status: {
      success: "✅ 簽到成功",
      partial: "⚠️ 部分成功",
      failed: "❌ 簽到失敗",
      error: "🔥 系統錯誤",
    },
    titles: {
      checkin_results: "簽到結果 (用戶數: ${count})",
      plugin_info: "🔌 插件信息",
      execution_time: "⏱️ 執行耗時",
      error_details: "錯誤詳情",
      retry_advice: "故障排查建議",
    },
    messages: {
      already_claimed: "重複簽到",
      cookie_expired: "Cookie 失效",
      activity_ended: "活動已結束",
      too_frequent: "簽到過於頻繁",
    },
    info: {
      plugin_name: "**插件名稱**: ${name}",
      plugin_version: "**插件版本**: ${version}",
      plugin_date: "**最後更新日期**: ${date}",
      plugin_author: "**插件作者**: ${author}",
      plugin_contact: "**聯繫方式**: ${contact}",
    },
  },
  ja: {
    status: {
      success: "✅ 成功",
      partial: "⚠️ 一部成功",
      failed: "❌ 失敗",
      error: " システムエラー",
    },
    titles: {
      checkin_results: "チェックイン結果 (ユーザー数: ${count})",
      plugin_info: " プラグイン情報",
      execution_time: "⏱️ 実行時間",
      error_details: "エラー詳細",
      retry_advice: "トラブルシューティングのアドバイス",
    },
    messages: {
      already_claimed: "すでに受け取り済みです",
      cookie_expired: "Cookie が期限切れです",
      activity_ended: "イベントは終了しました",
    },
    info: {
      plugin_name: "**名前**: ${name}",
      plugin_version: "**バージョン**: ${version}",
      plugin_date: "**最終更新日**: ${date}",
      plugin_author: "**作者**: ${author}",
      plugin_contact: "**連絡先**: ${contact}",
    },
  },
  ko: {
    status: {
      success: "✅ 성공",
      partial: "⚠️ 부분 성공",
      failed: "❌ 실패",
      error: "🔥 시스템 오류",
    },
    titles: {
      checkin_results: "체크인 결과 (사용자 수: ${count})",
      plugin_info: "🔌 플러그인 정보",
      execution_time: "⏱️ 실행 시간",
      error_details: "오류 상세 정보",
      retry_advice: "문제 해결 조언",
    },
    messages: {
      already_claimed: "이미 신청 완료",
      cookie_expired: "쿠키 만료",
      activity_ended: "이벤트 종료",
    },
    info: {
      plugin_name: "**이름**: ${name}",
      plugin_version: "**버전**: ${version}",
      plugin_date: "**최종 업데이트**: ${date}",
      plugin_author: "**작성자**: ${author}",
      plugin_contact: "**연락처**: ${contact}",
    },
  },
};

function mergeHookConfig(options, hookType) {
  const baseConfig = { ...options };
  delete baseConfig.postCheckin;
  delete baseConfig.onError;

  return {
    ...baseConfig,
    ...(options[hookType] || {}),
  };
}

export async function postCheckin(options, ctx) {
  const mergedConfig = mergeHookConfig(options, "postCheckin");
  const { webhook, language = "en", mentionUsers } = mergedConfig;

  if (!webhook) return;

  const t = createTranslator(language);
  const embed = buildEmbed(ctx, t);

  console.log("discord-notify:", ctx);
  const tag_filter = options["tag_filter"] || [0];
  let mentionString = "";
  if (getResultCountByRetcode(ctx.result, tag_filter) < ctx.result.length) {
    mentionString = buildMentionString(mentionUsers);
  }

  await sendNotification(webhook, {
    content: mentionString,
    embeds: [embed],
  });
}

export async function onError(options, ctx) {
  const mergedConfig = mergeHookConfig(options, "onError");
  const { webhook, language = "en", mentionUsers } = mergedConfig;

  if (!webhook) return;

  const t = createTranslator(language);
  const embed = buildErrorEmbed(ctx, t);

  await sendNotification(webhook, {
    content: buildMentionString(mentionUsers),
    embeds: [embed],
  });
}

function createTranslator(lang) {
  const locale = i18n[lang] || i18n.en;
  return (key, vars) => {
    let template = key.split(".").reduce((obj, k) => obj?.[k], locale);
    return template?.replace(/\${(\w+)}/g, (_, v) => vars?.[v] ?? "");
  };
}

function buildMentionString(users = []) {
  return users.map((id) => `<@${id}>`).join(" ");
}

function constructPluginInfo(fields = [name, author, date], meta, t) {
  let values = [];
  for (let field of fields) {
    let value = meta[field]
      ? t(`info.plugin_${field}`, { [field]: meta[field] })
      : "";
    values.push(value);
  }
  return values.filter((v) => v.length > 0).join("\n");
}

function buildEmbed(ctx, t) {
  const { result, timestamp, plugins_meta } = ctx;
  const executionTime = Date.now() - timestamp;

  let fields_option = ctx.fields || [
    "plugin_info",
    "execution_time",
    "checkin_results",
  ];

  let discord_fields = {
    plugin_info: {
      name: t("titles.plugin_info"),
      value: constructPluginInfo(["name", "author", "date"], plugins_meta, t),
      inline: true,
    },
    execution_time: {
      name: t("titles.execution_time"),
      value: `${executionTime}ms`,
      inline: true,
    },
    checkin_results: {
      name: t("titles.checkin_results", { count: result.length }),
      value: formatResults(result, t),
      inline: false,
    },
  };

  let embed_fields = fields_option.map((field) => discord_fields[field]);

  return {
    title: `${ctx.plugin_name ? `[${ctx.plugin_name}] ` : ""}${getResultTitle(result, t)}`,
    color: getStatusColor(result),
    fields: embed_fields,
    timestamp: new Date().toISOString(),
  };
}

function buildErrorEmbed(ctx, t) {
  const { error, plugin_name } = ctx;

  return {
    title: `${plugin_name ? `[${plugin_name}] ` : ""}${t("status.error")}`,
    color: 0xff0000,
    fields: [
      {
        name: t("titles.error_details"),
        value: `\`\`\`${error.stack || error.message}\`\`\``,
      },
      {
        name: t("titles.retry_advice"),
        value: [
          "• " + t("messages.cookie_expired"),
          "• " + t("messages.activity_ended"),
          "• Check network connection",
        ].join("\n"),
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

function getResultCountByRetcode(results, retcode) {
  return results.filter((r) => retcode.includes(r.retcode)).length;
}

// already-claimed / already-signed count as "ok" (not a failure) for title + color
const isOkRetcode = (rc) => [0, -5003, -2017, -2018].includes(rc);

function getResultTitle(results, t) {
  const ok = results.filter((r) => isOkRetcode(r.retcode)).length;

  if (ok === results.length) return t("status.success");
  if (ok > 0) return t("status.partial");
  return t("status.failed");
}

function getStatusColor(results) {
  const ok = results.filter((r) => isOkRetcode(r.retcode)).length;
  if (ok === results.length) return 0x00ff00; // green when all ok
  if (ok > 0) return 0xffa500; // orange when partial
  return 0xff0000; // red when all failed
}

function formatResults(results, t) {
  // compact one line per result; handles redeem (has `code`) and check-in (User N).
  // Discord caps a field value at 1024 chars, so keep it short and truncate safely.
  const lines = results.map((res, index) => {
    const label = res.code || `User ${index + 1}`;
    return `• ${label}: ${getResultStatus(res, t)}`;
  });
  let value = lines.join("\n");
  if (value.length > 1000) {
    value = value.slice(0, 960).replace(/\n[^\n]*$/, "") + `\n… (${results.length} total)`;
  }
  return value || "—";
}

function getResultStatus(res, t) {
  switch (res.retcode) {
    case 0:
      return t("status.success");
    case -5003:
    case -2017:
    case -2018:
      return t("messages.already_claimed");
    case -100:
      return t("messages.cookie_expired");
    case -1004:
      return t("messages.too_frequent");
    case -500012:
      return t("messages.activity_ended");
    default:
      return t("status.failed");
  }
}

async function sendNotification(webhook, payload) {
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Discord API Error:", await response.text());
    }
  } catch (error) {
    console.error("Failed to send Discord notification:", error);
  }
}
