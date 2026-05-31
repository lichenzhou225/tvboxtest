import fs from "fs";
import axios from "axios";

const sources = [
  "https://www.饭太硬.net/tv",
  "http://肥猫.live",
  "http://我不是.摸鱼儿.top",
  "http://tvbox.王二小放牛娃.top",
  "https://9280.kstore.vip/newwex.json"
];

const result = {
  sites: [],
  parses: [],
  lives: [],
  rules: []
};

const siteSet = new Set();
const parseSet = new Set();

async function request(url) {

  try {

    const res = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer":
          "https://www.google.com/"
      }
    });

    return res.data;

  } catch (e) {

    console.log("失败:", url);

    return null;
  }
}

function safeJson(text) {

  try {
    return JSON.parse(text);
  } catch (e) {}

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start !== -1 && end !== -1) {

    try {
      return JSON.parse(
        text.slice(start, end + 1)
      );
    } catch (e) {}
  }

  return null;
}

function isBase64(str) {

  if (!str || str.length < 30) {
    return false;
  }

  try {

    return Buffer.from(
      Buffer.from(str, "base64")
        .toString("utf8")
    ).toString("base64")
      .replace(/=/g, "") ===
      str.replace(/=/g, "");

  } catch {

    return false;
  }
}

function merge(json) {

  if (!json) return;

  // sites
  if (Array.isArray(json.sites)) {

    for (const site of json.sites) {

      const key =
        site.key ||
        site.api ||
        JSON.stringify(site);

      if (!siteSet.has(key)) {

        siteSet.add(key);

        result.sites.push(site);
      }
    }
  }

  // parses
  if (Array.isArray(json.parses)) {

    for (const parse of json.parses) {

      const key =
        parse.url ||
        JSON.stringify(parse);

      if (!parseSet.has(key)) {

        parseSet.add(key);

        result.parses.push(parse);
      }
    }
  }

  // lives
  if (Array.isArray(json.lives)) {
    result.lives.push(...json.lives);
  }

  // rules
  if (Array.isArray(json.rules)) {
    result.rules.push(...json.rules);
  }
}

async function parseSource(url) {

  console.log("处理:", url);

  let data = await request(url);

  if (!data) return;

  // 已经是JSON
  if (typeof data === "object") {

    merge(data);

    return;
  }

  let text = String(data);

  // base64
  if (isBase64(text)) {

    try {

      text = Buffer.from(
        text,
        "base64"
      ).toString("utf8");

    } catch {}
  }

  // 直接JSON
  let json = safeJson(text);

  if (json) {

    merge(json);

    return;
  }

  // HTML中找json链接
  const matches = text.match(
    /https?:\/\/[^"' ]+\.json/g
  );

  if (matches) {

    for (const link of matches) {

      console.log("发现JSON:", link);

      const subData = await request(link);

      if (!subData) continue;

      let subJson = null;

      if (typeof subData === "object") {

        subJson = subData;

      } else {

        subJson = safeJson(
          String(subData)
        );
      }

      if (subJson) {
        merge(subJson);
      }
    }
  }
}

async function run() {

  for (const url of sources) {

    try {

      await parseSource(url);

    } catch (e) {

      console.log(e);
    }
  }

  fs.mkdirSync("output", {
    recursive: true
  });

  fs.writeFileSync(
    "output/merged.json",
    JSON.stringify(result, null, 2),
    "utf8"
  );

  console.log(
    "完成:",
    result.sites.length
  );
}

run();

