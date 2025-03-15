export const meta = {
  name: "Genshin Sign",
  version: "0.0.1",
  author: "mastersamasama",
  date: "2025-03-02",
  contact: "https://github.com/mastersamasama/mihoyo-checkin/issues",
};

async function checkinHandler(cookies, lang = "en-us") {
  const payload = {
    act_id: "e202102251931481",
  };

  const headers = {
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
  };

  try {
    const response = await fetch(
      `https://sg-hk4e-api.hoyolab.com/event/sol/sign?lang=${lang}`,
      {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("API Request Failed:", error);
    throw error;
  }
}

export const checkin = async (config) => {
  let result = [];
  for (let user of config.users) {
    let response = await checkinHandler(user.cookies, config.lang || 'en-us');
    result.push(response);
  }
  console.log("genshin checkin result", result);
  return result;
};