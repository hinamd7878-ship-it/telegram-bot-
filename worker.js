// ---------- Insert Your Data ---------- //

const BOT_TOKEN = "8916067859:AAGk-fhTn16wlhZm45s054VRpYW-quApths";
const BOT_WEBHOOK = "/endpoint";
const BOT_SECRET = "NightflixSecret_2026_X7p9";
const BOT_OWNER = 6042349826;
const BOT_USERNAME = "Nightflix_reel_bot";
const BOT_CHANNEL = -1004320158707;
const SIA_SECRET = "NightflixFileSecret_2026_K4m8Z2";
const PUBLIC_BOT = false;

// ---------- Do Not Modify ---------- //

const WHITE_METHODS = ["GET", "POST", "HEAD"];

const HEADERS_FILE = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range"
};

const HEADERS_ERRR = {
  "Access-Control-Allow-Origin": "*",
  "content-type": "application/json"
};

const ERROR_404 = {
  ok: false,
  error_code: 404,
  description: "Bad Request: missing /?file= parameter"
};

const ERROR_405 = {
  ok: false,
  error_code: 405,
  description: "Bad Request: method not allowed"
};

const ERROR_406 = {
  ok: false,
  error_code: 406,
  description: "Bad Request: file type invalid"
};

const ERROR_407 = {
  ok: false,
  error_code: 407,
  description: "Bad Request: file hash invalid"
};

const ERROR_408 = {
  ok: false,
  error_code: 408,
  description: "Bad Request: mode not in [attachment, inline, tv]"
};


// ---------- Event Listener ---------- //

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});


async function handleRequest(event) {

  const url = new URL(event.request.url);

  const file = url.searchParams.get("file");
  const mode = url.searchParams.get("mode") || "attachment";


  // Telegram webhook
  if (url.pathname === BOT_WEBHOOK) {
    return Bot.handleWebhook(event);
  }

  // Register webhook
  if (url.pathname === "/registerWebhook") {
    return Bot.registerWebhook(event, url, BOT_WEBHOOK, BOT_SECRET);
  }

  // Remove webhook
  if (url.pathname === "/unregisterWebhook") {
    return Bot.unregisterWebhook(event);
  }

  // Test bot
  if (url.pathname === "/getMe") {
    return new Response(
      JSON.stringify(await Bot.getMe()),
      {
        headers: HEADERS_ERRR,
        status: 200
      }
    );
  }


  // File required
  if (!file) {
    return Raise(ERROR_404, 404);
  }


  // Mode check
  if (!["attachment", "inline", "tv"].includes(mode)) {
    return Raise(ERROR_408, 404);
  }


  // HTTP method
  if (!WHITE_METHODS.includes(event.request.method)) {
    return Raise(ERROR_405, 405);
  }


  // Decode hash
  let file_id;

  try {
    file_id = await Cryptic.deHash(file);
  } catch (error) {
    return Raise(ERROR_407, 404);
  }


  // Retrieve file
  const retrieve = await RetrieveFile(
    BOT_CHANNEL,
    file_id,
    event.request
  );


  if (retrieve.error_code) {
    return Raise(
      retrieve,
      retrieve.error_code || 502
    );
  }


  const rdata = retrieve[0];
  const rname = retrieve[1];
  const rsize = retrieve[2];
  const rtype = retrieve[3];


  // ---------- TV MODE ---------- //

  if (mode === "tv") {

    return new Response(
      TVPlayer(
        url.origin,
        file,
        rname,
        rtype
      ),
      {
        status: 200,
        headers: {
          "content-type": "text/html; charset=UTF-8",
          "cache-control": "no-store",
          ...HEADERS_FILE
        }
      }
    );
  }


  // ---------- FILE STREAM ---------- //

  const headers = new Headers(HEADERS_FILE);

  headers.set(
    "Content-Disposition",
    `${mode}; filename="${String(rname).replace(/["\\]/g, "")}"`
  );

  headers.set(
    "Content-Type",
    rtype || "application/octet-stream"
  );

  headers.set(
    "Accept-Ranges",
    "bytes"
  );


  const contentLength =
    rdata.headers.get("Content-Length");

  const contentRange =
    rdata.headers.get("Content-Range");


  if (contentLength) {

    headers.set(
      "Content-Length",
      contentLength
    );

  } else if (!event.request.headers.get("Range")) {

    headers.set(
      "Content-Length",
      String(rsize)
    );
  }


  if (contentRange) {

    headers.set(
      "Content-Range",
      contentRange
    );
  }


  return new Response(
    event.request.method === "HEAD"
      ? null
      : rdata.body,
    {
      status: rdata.status || 200,
      headers
    }
  );
}


// ---------- Retrieve File ---------- //

async function RetrieveFile(
  channel_id,
  message_id,
  request
) {

  let fID;
  let fName;
  let fType;
  let fSize;
  let fLen;


  // Get channel message
  const data = await Bot.editMessage(
    channel_id,
    message_id,
    await UUID()
  );


  if (data.error_code) {
    return data;
  }


  // Document
  if (data.document) {

    fLen = data.document.length - 1;

    fID = data.document.file_id;
    fName = data.document.file_name;
    fType = data.document.mime_type;
    fSize = data.document.file_size;

  }

  // Audio
  else if (data.audio) {

    fLen = data.audio.length - 1;

    fID = data.audio.file_id;
    fName = data.audio.file_name;
    fType = data.audio.mime_type;
    fSize = data.audio.file_size;

  }

  // Video
  else if (data.video) {

    fLen = data.video.length - 1;

    fID = data.video.file_id;
    fName = data.video.file_name;
    fType = data.video.mime_type;
    fSize = data.video.file_size;

  }

  // Photo
  else if (data.photo) {

    fLen = data.photo.length - 1;

    fID = data.photo[fLen].file_id;

    fName =
      data.photo[fLen].file_unique_id +
      ".jpg";

    fType = "image/jpeg";

    fSize = data.photo[fLen].file_size;

  }

  else {

    return ERROR_406;
  }


  // Telegram getFile
  const file = await Bot.getFile(fID);


  if (file.error_code) {
    return file;
  }


  // Range header
  const range =
    request.headers.get("Range");


  // Telegram file
  const fileResponse =
    await Bot.fetchFile(
      file.file_path,
      range
    );


  if (
    !fileResponse.ok &&
    fileResponse.status !== 206
  ) {

    return {
      error_code:
        fileResponse.status || 502,

      description:
        "Unable to fetch file from Telegram"
    };
  }


  return [
    fileResponse,
    fName,
    fSize,
    fType
  ];
}


// ---------- Error ---------- //

async function Raise(
  json_error,
  status_code
) {

  return new Response(
    JSON.stringify(json_error),
    {
      headers: HEADERS_ERRR,
      status: status_code
    }
  );
}


// ---------- UUID ---------- //

async function UUID() {

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
    .replace(
      /[xy]/g,
      function(c) {

        const r =
          Math.random() * 16 | 0;

        const v =
          c === "x"
            ? r
            : (r & 0x3 | 0x8);

        return v.toString(16);
      }
    );
}


// ---------- Cryptic Hash ---------- //

class Cryptic {

  static async getSalt(length = 16) {

    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let salt = "";

    for (
      let i = 0;
      i < length;
      i++
    ) {

      salt +=
        characters.charAt(
          Math.floor(
            Math.random() *
            characters.length
          )
        );
    }

    return salt;
  }


  static async getKey(
    salt,
    iterations = 1000,
    keyLength = 32
  ) {

    const key =
      new Uint8Array(keyLength);


    for (
      let i = 0;
      i < keyLength;
      i++
    ) {

      key[i] =
        (
          SIA_SECRET.charCodeAt(
            i % SIA_SECRET.length
          ) +
          salt.charCodeAt(
            i % salt.length
          )
        ) % 256;
    }


    for (
      let j = 0;
      j < iterations;
      j++
    ) {

      for (
        let i = 0;
        i < keyLength;
        i++
      ) {

        key[i] =
          (
            key[i] +
            SIA_SECRET.charCodeAt(
              i % SIA_SECRET.length
            ) +
            salt.charCodeAt(
              i % salt.length
            )
          ) % 256;
      }
    }

    return key;
  }


  static async baseEncode(input) {

    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let output = "";
    let buffer = 0;
    let bitsLeft = 0;


    for (
      let i = 0;
      i < input.length;
      i++
    ) {

      buffer =
        (buffer << 8) |
        input.charCodeAt(i);

      bitsLeft += 8;


      while (bitsLeft >= 5) {

        output +=
          alphabet[
            (buffer >> (bitsLeft - 5)) &
            31
          ];

        bitsLeft -= 5;
      }
    }


    if (bitsLeft > 0) {

      output +=
        alphabet[
          (buffer << (5 - bitsLeft)) &
          31
        ];
    }


    return output;
  }


  static async baseDecode(input) {

    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    const lookup = {};


    for (
      let i = 0;
      i < alphabet.length;
      i++
    ) {

      lookup[alphabet[i]] = i;
    }


    let buffer = 0;
    let bitsLeft = 0;
    let output = "";


    for (
      let i = 0;
      i < input.length;
      i++
    ) {

      const value =
        lookup[input[i]];


      if (value === undefined) {
        throw new Error("Invalid hash");
      }


      buffer =
        (buffer << 5) |
        value;

      bitsLeft += 5;


      if (bitsLeft >= 8) {

        output +=
          String.fromCharCode(
            (buffer >> (bitsLeft - 8)) &
            255
          );

        bitsLeft -= 8;
      }
    }


    return output;
  }


  static async Hash(text) {

    const salt =
      await this.getSalt();

    const key =
      await this.getKey(salt);


    const encoded =
      String(text)
        .split("")
        .map(
          (char, index) => {

            return String.fromCharCode(
              char.charCodeAt(0) ^
              key[index % key.length]
            );
          }
        )
        .join("");


    return await this.baseEncode(
      salt + encoded
    );
  }


  static async deHash(hashed) {

    const decoded =
      await this.baseDecode(hashed);


    if (decoded.length < 17) {
      throw new Error("Invalid hash");
    }


    const salt =
      decoded.substring(0, 16);

    const encoded =
      decoded.substring(16);


    const key =
      await this.getKey(salt);


    return encoded
      .split("")
      .map(
        (char, index) => {

          return String.fromCharCode(
            char.charCodeAt(0) ^
            key[index % key.length]
          );
        }
      )
      .join("");
  }
}


// ---------- TV PLAYER ---------- //

function TVPlayer(
  origin,
  file,
  fileName,
  mimeType
) {

  const streamUrl =
    `${origin}/?file=${encodeURIComponent(file)}&mode=inline`;


  const safeName =
    String(fileName || "Video")
      .replace(
        /[&<>"']/g,
        c =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
          }[c])
      );


  const safeType =
    String(mimeType || "video/mp4")
      .replace(
        /[^a-zA-Z0-9+./-]/g,
        ""
      );


  return `<!doctype html>
<html lang="en">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>${safeName}</title>


<style>

html,
body {
  margin: 0;
  width: 100%;
  height: 100%;
  background: #000;
  color: #fff;
  font-family: Arial, sans-serif;
  overflow: hidden;
}

.player {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.panel {
  position: fixed;
  left: 50%;
  bottom: 5%;
  transform: translateX(-50%);

  display: flex;
  gap: 14px;
  align-items: center;

  background: rgba(0,0,0,.78);

  padding: 14px 18px;

  border-radius: 14px;

  z-index: 5;
}

button {
  font-size: 22px;

  min-width: 64px;
  min-height: 52px;

  padding: 8px 14px;

  border: 2px solid #777;

  border-radius: 10px;

  background: #222;
  color: #fff;
}

button:focus {
  outline: 4px solid #fff;
  outline-offset: 2px;
}

#status {
  font-size: 18px;
  min-width: 110px;
  text-align: center;
}

#title {
  position: fixed;

  top: 18px;

  left: 20px;
  right: 20px;

  text-align: center;

  font-size: 22px;

  text-shadow:
    0 2px 5px #000;

  z-index: 5;
}

</style>

</head>


<body>

<div class="player">

  <div id="title">
    ${safeName}
  </div>


  <video
    id="v"
    controls
    preload="metadata"
    tabindex="0"
    playsinline
  >

    <source
      src="${streamUrl}"
      type="${safeType}"
    >

  </video>


  <div
    class="panel"
    id="panel"
  >

    <button
      id="back"
      tabindex="0"
    >
      ↶ 10s
    </button>


    <button
      id="play"
      tabindex="0"
    >
      ▶ / ❚❚
    </button>


    <button
      id="forward"
      tabindex="0"
    >
      10s ↷
    </button>


    <span id="status">
      Ready
    </span>

  </div>

</div>


<script>

const v =
  document.getElementById("v");

const play =
  document.getElementById("play");

const back =
  document.getElementById("back");

const forward =
  document.getElementById("forward");

const status =
  document.getElementById("status");

const panel =
  document.getElementById("panel");


function toggle() {

  if (v.paused) {

    v.play().catch(() => {});

  } else {

    v.pause();

  }

}


play.onclick = toggle;


back.onclick = () => {

  v.currentTime =
    Math.max(
      0,
      v.currentTime - 10
    );

};


forward.onclick = () => {

  v.currentTime =
    Math.min(
      v.duration || Infinity,
      v.currentTime + 10
    );

};


v.onplay = () => {
  status.textContent = "Playing";
};


v.onpause = () => {
  status.textContent = "Paused";
};


v.onwaiting = () => {
  status.textContent = "Buffering...";
};


v.onplaying = () => {
  status.textContent = "Playing";
};


v.onerror = () => {
  status.textContent = "Video error";
};


document.addEventListener(
  "keydown",
  e => {

    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Enter",
        " ",
        "MediaPlayPause"
      ].includes(e.key)
    ) {

      if (e.key === "ArrowLeft") {

        e.preventDefault();

        v.currentTime =
          Math.max(
            0,
            v.currentTime - 10
          );

      }

      else if (
        e.key === "ArrowRight"
      ) {

        e.preventDefault();

        v.currentTime =
          Math.min(
            v.duration || Infinity,
            v.currentTime + 10
          );

      }

      else if (
        e.key === "ArrowUp"
      ) {

        e.preventDefault();

        back.focus();

      }

      else if (
        e.key === "ArrowDown"
      ) {

        e.preventDefault();

        forward.focus();

      }

      else if (
        e.key === "Enter" ||
        e.key === " " ||
        e.key === "MediaPlayPause"
      ) {

        e.preventDefault();

        toggle();

      }

    }

  }
);


panel.addEventListener(
  "mouseenter",
  () => {
    panel.style.opacity = "1";
  }
);


setTimeout(
  () => {
    panel.style.opacity = ".35";
  },
  5000
);

</script>

</body>
</html>`;
}


// ---------- Telegram Bot ---------- //

class Bot {

  static async handleWebhook(event) {

    const secret =
      event.request.headers.get(
        "X-Telegram-Bot-Api-Secret-Token"
      );


    if (secret !== BOT_SECRET) {

      return new Response(
        "Unauthorized",
        {
          status: 403
        }
      );
    }


    const update =
      await event.request.json();


    event.waitUntil(
      this.Update(event, update)
    );


    return new Response("Ok");
  }


  static async registerWebhook(
    event,
    requestUrl,
    suffix,
    secret
  ) {

    const webhookUrl =
      `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;


    const data =
      await this.telegram(
        "setWebhook",
        {
          url: webhookUrl,
          secret_token: secret
        }
      );


    return new Response(
      JSON.stringify(data),
      {
        headers: HEADERS_ERRR
      }
    );
  }


  static async unregisterWebhook() {

    const data =
      await this.telegram(
        "setWebhook",
        {
          url: ""
        }
      );


    return new Response(
      JSON.stringify(data),
      {
        headers: HEADERS_ERRR
      }
    );
  }


  static async getMe() {

    return await this.telegram(
      "getMe"
    );
  }


  static async telegram(
    methodName,
    params = null,
    maxRetries = 1
  ) {

    for (
      let attempt = 0;
      attempt <= maxRetries;
      attempt++
    ) {

      const response =
        await fetch(
          await this.apiUrl(
            methodName,
            params
          )
        );


      const data =
        await response.json();


      if (
        response.status !== 429 ||
        attempt >= maxRetries
      ) {

        return data;
      }


      const retryAfter =
        Number(
          data?.parameters?.retry_after || 1
        );


      const waitMs =
        Math.min(
          Math.max(
            retryAfter,
            1
          ),
          15
        ) * 1000;


      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            waitMs
          )
      );
    }
  }


  static async sendMessage(
    chat_id,
    reply_id,
    text,
    reply_markup = []
  ) {

    const data =
      await this.telegram(
        "sendMessage",
        {
          chat_id,
          reply_to_message_id: reply_id,
          parse_mode: "markdown",
          text,
          reply_markup:
            JSON.stringify({
              inline_keyboard:
                reply_markup
            })
        }
      );


    return data.result || data;
  }


  static async sendDocument(
    chat_id,
    file_id
  ) {

    const data =
      await this.telegram(
        "sendDocument",
        {
          chat_id,
          document: file_id
        }
      );


    return data.result || data;
  }


  static async sendPhoto(
    chat_id,
    file_id
  ) {

    const data =
      await this.telegram(
        "sendPhoto",
        {
          chat_id,
          photo: file_id
        }
      );


    return data.result || data;
  }


  static async editMessage(
    channel_id,
    message_id,
    caption_text
  ) {

    const data =
      await this.telegram(
        "editMessageCaption",
        {
          chat_id: channel_id,
          message_id,
          caption: caption_text
        }
      );


    return data.result || data;
  }


  static async answerInlineArticle(
    query_id,
    title,
    description,
    text,
    reply_markup = [],
    id = "1"
  ) {

    const dataObj = [
      {
        type: "article",
        id,
        title,
        thumbnail_url:
          "https://i.ibb.co/5s8hhND/dac5fa134448.png",
        description,
        input_message_content: {
          message_text: text,
          parse_mode: "markdown"
        },
        reply_markup: {
          inline_keyboard:
            reply_markup
        }
      }
    ];


    const data =
      await this.telegram(
        "answerInlineQuery",
        {
          inline_query_id: query_id,
          results:
            JSON.stringify(dataObj),
          cache_time: 1
        }
      );


    return data.result || data;
  }


  static async answerInlineDocument(
    query_id,
    title,
    file_id,
    mime_type,
    reply_markup = [],
    id = "1"
  ) {

    const dataObj = [
      {
        type: "document",
        id,
        title,
        document_file_id: file_id,
        mime_type,
        description: mime_type,
        reply_markup: {
          inline_keyboard:
            reply_markup
        }
      }
    ];


    const data =
      await this.telegram(
        "answerInlineQuery",
        {
          inline_query_id: query_id,
          results:
            JSON.stringify(dataObj),
          cache_time: 1
        }
      );


    return data.result || data;
  }


  static async answerInlinePhoto(
    query_id,
    title,
    photo_id,
    reply_markup = [],
    id = "1"
  ) {

    const dataObj = [
      {
        type: "photo",
        id,
        title,
        photo_file_id: photo_id,
        reply_markup: {
          inline_keyboard:
            reply_markup
        }
      }
    ];


    const data =
      await this.telegram(
        "answerInlineQuery",
        {
          inline_query_id: query_id,
          results:
            JSON.stringify(dataObj),
          cache_time: 1
        }
      );


    return data.result || data;
  }


  static async getFile(file_id) {

    return await this.telegram(
      "getFile",
      {
        file_id
      }
    );
  }


  static async fetchFile(
    file_path,
    range = null
  ) {

    const headers = {};


    if (range) {

      headers["Range"] =
        range;
    }


    return await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${file_path}`,
      {
        headers,
        redirect: "follow"
      }
    );
  }


  static async apiUrl(
    methodName,
    params = null
  ) {

    let query = "";


    if (params) {

      query =
        "?" +
        new URLSearchParams(
          params
        ).toString();
    }


    return `https://api.telegram.org/bot${BOT_TOKEN}/${methodName}${query}`;
  }


  static async Update(
    event,
    update
  ) {

    if (update.inline_query) {

      await onInline(
        event,
        update.inline_query
      );
    }


    if ("message" in update) {

      await onMessage(
        event,
        update.message
      );
    }
  }
}


// ---------- Inline Listener ---------- //

async function onInline(
  event,
  inline
) {

  let fID;
  let fName;
  let fType;
  let fSize;
  let fLen;


  if (
    !PUBLIC_BOT &&
    inline.from.id != BOT_OWNER
  ) {

    const buttons = [
      [
        {
          text: "Source Code",
          url:
            "https://github.com/vauth/filestream-cf"
        }
      ]
    ];


    return Bot.answerInlineArticle(
      inline.id,
      "Access forbidden",
      "Deploy your own filestream-cf.",
      "❌ Access forbidden.",
      buttons
    );
  }


  let message_id;


  try {

    message_id =
      await Cryptic.deHash(
        inline.query
      );

  } catch {

    return Bot.answerInlineArticle(
      inline.id,
      "Error",
      ERROR_407.description,
      ERROR_407.description
    );
  }


  const data =
    await Bot.editMessage(
      BOT_CHANNEL,
      message_id,
      await UUID()
    );


  if (data.error_code) {

    return Bot.answerInlineArticle(
      inline.id,
      "Error",
      data.description,
      data.description
    );
  }


  if (data.document) {

    fLen =
      data.document.length - 1;

    fID =
      data.document.file_id;

    fName =
      data.document.file_name;

    fType =
      data.document.mime_type;

    fSize =
      data.document.file_size;

  }

  else if (data.audio) {

    fLen =
      data.audio.length - 1;

    fID =
      data.audio.file_id;

    fName =
      data.audio.file_name;

    fType =
      data.audio.mime_type;

    fSize =
      data.audio.file_size;

  }

  else if (data.video) {

    fLen =
      data.video.length - 1;

    fID =
      data.video.file_id;

    fName =
      data.video.file_name;

    fType =
      data.video.mime_type;

    fSize =
      data.video.file_size;

  }

  else if (data.photo) {

    fLen =
      data.photo.length - 1;

    fID =
      data.photo[fLen].file_id;

    fName =
      data.photo[fLen].file_unique_id +
      ".jpg";

    fType =
      "image/jpeg";

    fSize =
      data.photo[fLen].file_size;

  }

  else {

    return ERROR_406;
  }


  if (fType === "image/jpeg") {

    const buttons = [
      [
        {
          text: "Send Again",
          switch_inline_query_current_chat:
            inline.query
        }
      ]
    ];


    return Bot.answerInlinePhoto(
      inline.id,
      fName || "image",
      fID,
      buttons
    );
  }


  const buttons = [
    [
      {
        text: "Send Again",
        switch_inline_query_current_chat:
          inline.query
      }
    ]
  ];


  return Bot.answerInlineDocument(
    inline.id,
    fName || "file",
    fID,
    fType,
    buttons
  );
}


// ---------- Message Listener ---------- //

async function onMessage(
  event,
  message
) {

  let fID;
  let fName;
  let fSave;


  const url =
    new URL(event.request.url);


  const bot = {
    username: BOT_USERNAME
  };


  // Ignore bot's own messages
  if (
    message.via_bot &&
    message.via_bot.username ===
      bot.username
  ) {
    return;
  }


  // Ignore channel messages
  if (
    message.chat &&
    String(message.chat.id).startsWith("-100")
  ) {
    return;
  }


  // ---------- /start ---------- //

  if (
    message.text &&
    message.text.startsWith("/start ")
  ) {

    const file =
      message.text.substring(7);


    let message_id;


    try {

      message_id =
        await Cryptic.deHash(file);

    } catch {

      return Bot.sendMessage(
        message.chat.id,
        message.message_id,
        ERROR_407.description
      );
    }


    const data =
      await Bot.editMessage(
        BOT_CHANNEL,
        message_id,
        await UUID()
      );


    if (data.error_code) {

      return Bot.sendMessage(
        message.chat.id,
        message.message_id,
        data.description
      );
    }


    if (data.document) {

      return Bot.sendDocument(
        message.chat.id,
        data.document.file_id
      );
    }


    if (data.audio) {

      return Bot.sendDocument(
        message.chat.id,
        data.audio.file_id
      );
    }


    if (data.video) {

      return Bot.sendDocument(
        message.chat.id,
        data.video.file_id
      );
    }


    if (data.photo) {

      return Bot.sendPhoto(
        message.chat.id,
        data.photo[
          data.photo.length - 1
        ].file_id
      );
    }


    return Bot.sendMessage(
      message.chat.id,
      message.message_id,
      "Bad Request: File not found"
    );
  }


  // ---------- Private bot ---------- //

  if (
    !PUBLIC_BOT &&
    message.chat.id != BOT_OWNER
  ) {

    return Bot.sendMessage(
      message.chat.id,
      message.message_id,
      "❌ Access forbidden."
    );
  }


  // ---------- Document ---------- //

  if (message.document) {

    fID =
      message.document.file_id;

    fName =
      message.document.file_name;

    fSave =
      await Bot.sendDocument(
        BOT_CHANNEL,
        fID
      );
  }


  // ---------- Audio ---------- //

  else if (message.audio) {

    fID =
      message.audio.file_id;

    fName =
      message.audio.file_name;

    fSave =
      await Bot.sendDocument(
        BOT_CHANNEL,
        fID
      );
  }


  // ---------- Video ---------- //

  else if (message.video) {

    fID =
      message.video.file_id;

    fName =
      message.video.file_name;

    fSave =
      await Bot.sendDocument(
        BOT_CHANNEL,
        fID
      );
  }


  // ---------- Photo ---------- //

  else if (message.photo) {

    fID =
      message.photo[
        message.photo.length - 1
      ].file_id;

    fName =
      message.photo[
        message.photo.length - 1
      ].file_unique_id +
      ".jpg";


    fSave =
      await Bot.sendPhoto(
        BOT_CHANNEL,
        fID
      );
  }


  // ---------- Invalid ---------- //

  else {

    return Bot.sendMessage(
      message.chat.id,
      message.message_id,
      "Send me any file/video/audio/photo."
    );
  }


  // ---------- Save Error ---------- //

  if (
    !fSave ||
    fSave.error_code ||
    !fSave.message_id
  ) {

    return Bot.sendMessage(
      message.chat.id,
      message.message_id,
      `❌ File save nahi ho payi.

Telegram Error:
${JSON.stringify(fSave)}`
    );
  }


  // ---------- Generate Hash ---------- //

  const final_hash =
    await Cryptic.Hash(
      fSave.message_id
    );


  const final_link =
    `${url.origin}/?file=${final_hash}`;


  const final_tv =
    `${url.origin}/?file=${final_hash}&mode=tv`;


  const final_tele =
    `https://t.me/${bot.username}?start=${final_hash}`;


  const buttons = [

    [
      {
        text: "Telegram Link",
        url: final_tele
      },

      {
        text: "Inline Link",
        switch_inline_query:
          final_hash
      }
    ],

    [

      {
        text: "📺 TV Stream",
        url: final_tv
      },

      {
        text: "⬇️ Download",
        url: final_link
      }

    ]

  ];


  const final_text =
    `*🗂 File Name:* \`${fName}\`\n` +
    `*⚙️ File Hash:* \`${final_hash}\``;


  return Bot.sendMessage(
    message.chat.id,
    message.message_id,
    final_text,
    buttons
  );
}
