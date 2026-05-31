
import fs from "fs";
import axios from "axios";

const sources = [
  {
    name: "饭太硬",
    url: "https://www.饭太硬.net/tv"
  },
  {
    name: "肥猫",
    url: "http://肥猫.live"
  },
  {
    name: "摸鱼儿",
    url: "http://我不是.摸鱼儿.top"
  },
  {
    name: "王二小",
    url: "https://9280.kstore.vip/newwex.json"
  }
];

const result = {
  sites: [],
  parses: [],
  lives: [],
  rules: []
};

const siteSet = new Set();
const parseSet = new Set();

async function fetchUrl(url) {

  try {

    const res = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0",
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

// JSON安全解析
function safeJson(text) {

  try {

    return JSON.parse(text);

  } catch {}

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start !== -1 && end !== -1) {

    try {

      return JSON.parse(
        text.slice(start, end + 1)
      );

    } catch {}
  }

  return null;
}

// Base64检测
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

// 合并
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

// 从HTML提取json链接
function extractJsonUrls(html) {

  const urls = [];

  // json链接
  const regex =
    /https?:\/\/[^"' ]+\.(json|txt)/g;

  const matches = html.match(regex);

  if (matches) {
    urls.push(...matches);
  }

  return [...new Set(urls)];
}

async function parseSource(item) {

  console.log("处理:", item.name);

  let data = await fetchUrl(item.url);

  if (!data) return;

  // 已经是JSON
  if (typeof data === "object") {

    merge(data);

    return;
  }

  let text = String(data);

  // Base64
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

  // HTML提取
  const subUrls =
    extractJsonUrls(text);

  console.log(
    item.name,
    "发现链接:",
    subUrls.length
  );

  for (const subUrl of subUrls) {

    try {

      const subData =
        await fetchUrl(subUrl);

      if (!subData) continue;

      let subJson = null;

      if (
        typeof subData === "object"
      ) {

        subJson = subData;

      } else {

        let subText =
          String(subData);

        if (isBase64(subText)) {

          try {

            subText = Buffer.from(
              subText,
              "base64"
            ).toString("utf8");

          } catch {}
        }

        subJson = safeJson(subText);
      }

      if (subJson) {

        console.log(
          "成功:",
          subUrl
        );

        merge(subJson);
      }

    } catch (e) {}
  }
}

async function run() {

  for (const item of sources) {

    try {

      await parseSource(item);

    } catch (e) {

      console.log(e);
    }
  }

  fs.mkdirSync(
    "output",
    { recursive: true }
  );

  fs.writeFileSync(
    "output/merged.json",
    JSON.stringify(result, null, 2),
    "utf8"
  );

  console.log(
    "sites:",
    result.sites.length
  );

  console.log(
    "parses:",
    result.parses.length
  );
}

run();
