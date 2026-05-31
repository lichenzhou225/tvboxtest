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

async function fetchJson(url) {

  try {

    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0"
      }
    });

    let text = res.data;

    if (typeof text !== "string") {
      return text;
    }

    // base64
    if (isBase64(text)) {

      try {

        text = Buffer.from(
          text,
          "base64"
        ).toString("utf8");

      } catch (e) {}
    }

    return safeJson(text);

  } catch (err) {

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

  if (!str || str.length < 20) {
    return false;
  }

  try {

    return Buffer.from(
      Buffer.from(str, "base64").toString(
        "utf8"
      )
    ).toString("base64")
      .replace(/=/g, "") ===
      str.replace(/=/g, "");

  } catch {

    return false;
  }
}

async function run() {

  for (const url of sources) {

    console.log("抓取:", url);

    const json = await fetchJson(url);

    if (!json) continue;

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

  fs.mkdirSync("output", {
    recursive: true
  });

  fs.writeFileSync(
    "output/merged.json",
    JSON.stringify(result, null, 2),
    "utf8"
  );

  console.log("完成");
}

run();

