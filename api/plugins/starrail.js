export const meta = {
  name: "starrail-sign",
  version: "0.0.2",
  author: "mastersamasama",
  date: "2025-03-20",
  contact: "https://github.com/mastersamasama/mihoyo-checkin/issues",
  description: "Help get Honkai: Star Rail daily checkin rewards",
  support: "os",
};

const API_CONFIG = {
  ACT_ID: "e202303301540311",
  BASE_URL: "https://sg-public-api.hoyolab.com/event/luna/os/sign",
  DEFAULT_LANG: "en-us",
  MAX_RETRY: 1,
  RETRY_DELAY: 1000,
};

const generateHeaders = (cookies) => ({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  Origin: "https://act.hoyolab.com",
  Referer: "https://act.hoyolab.com/",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Priority: "u=1, i",
  "Sec-Ch-Ua":
    '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
  Cookie: cookies,
});

const generatePayload = () => ({
  act_id: API_CONFIG.ACT_ID,
});

async function fetchWithRetry(url, options, retries = API_CONFIG.MAX_RETRY) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY * (i + 1)));
    }
  }
}

function validateUserInput(user) {
  if (!user?.cookies?.trim()) {
    throw new Error("Invalid cookies provided");
  }
}

async function checkinHandler(cookies, lang = API_CONFIG.DEFAULT_LANG) {
  try {
    const url = new URL(API_CONFIG.BASE_URL);
    url.searchParams.append("lang", lang);

    const result = await fetchWithRetry(url.toString(), {
      method: "POST",
      headers: generateHeaders(cookies),
      body: JSON.stringify(generatePayload()),
      credentials: "include",
    });

    return result;
  } catch (error) {
    console.error(`Checkin failed: ${error.message}`);
    return { 
      success: false, 
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

export const checkin = async (config) => {
  if (!config?.users?.length) {
    throw new Error("No users configured");
  }

  const results = await Promise.all(
    config.users.map(async (user) => {
      try {
        validateUserInput(user);
        return await checkinHandler(
          user.cookies,
          config.lang || API_CONFIG.DEFAULT_LANG
        );
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    })
  );

  console.log("Genshin checkin results:", results);

  return results;
};