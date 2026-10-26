import crypto from "node:crypto";


const GITHUB_API =
  "https://api.github.com";


const MANUAL_FILE_PATH =
  "data/manual-news.json";

const AUTOMATIC_FILE_PATH =
  "data/news.json";


const CORS_HEADERS = {
  "Access-Control-Allow-Origin":
    "https://meliak1.github.io",

  "Access-Control-Allow-Headers":
    "Content-Type, Authorization",

  "Access-Control-Allow-Methods":
    "GET, POST, PUT, DELETE, OPTIONS"
};


const ALLOWED_ACADEMICIANS = {
  "Costas Synolakis":
    "Κώστας Συνολάκης",

  "Georgios Marios Karagiannis":
    "Γεώργιος Μάριος Καραγιάννης"
};


/*
 * ============================================================
 * RESPONSE
 * ============================================================
 */

function jsonResponse(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json",

        ...CORS_HEADERS
      }
    }
  );
}


/*
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

function getConfig() {
  const token =
    process.env.GITHUB_TOKEN;

  const owner =
    process.env.GITHUB_OWNER;

  const repo =
    process.env.GITHUB_REPO;

  const branch =
    process.env.GITHUB_BRANCH ||
    "main";

  const adminPassword =
    process.env.ADMIN_PASSWORD;


  if (
    !token ||
    !owner ||
    !repo ||
    !adminPassword
  ) {
    throw new Error(
      "Server configuration is incomplete."
    );
  }


  return {
    token,
    owner,
    repo,
    branch,
    adminPassword
  };
}


/*
 * ============================================================
 * AUTHENTICATION
 * ============================================================
 */

function isAuthenticated(
  request,
  adminPassword
) {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  const expected =
    `Bearer ${adminPassword}`;

  return (
    authorization === expected
  );
}


/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normaliseDomain(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}


function githubHeaders(token) {
  return {
    "Accept":
      "application/vnd.github+json",

    "Authorization":
      `Bearer ${token}`,

    "X-GitHub-Api-Version":
      "2022-11-28",

    "User-Agent":
      "ndcm-news-admin"
  };
}


async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}


/*
 * ============================================================
 * GENERIC GITHUB FILE READER
 * ============================================================
 */

async function readJsonFile(
  config,
  filePath
) {
  const url =
    `${GITHUB_API}/repos/` +
    `${config.owner}/` +
    `${config.repo}/contents/` +
    `${filePath}` +
    `?ref=${encodeURIComponent(
      config.branch
    )}`;


  const response =
    await fetch(
      url,
      {
        headers:
          githubHeaders(
            config.token
          )
      }
    );


  if (!response.ok) {
    throw new Error(
      `Unable to read ${filePath}: ${response.status}`
    );
  }


  const fileData =
    await response.json();


  const content =
    Buffer
      .from(
        fileData.content,
        "base64"
      )
      .toString("utf8");


  let articles;


  try {
    articles =
      JSON.parse(content);
  } catch {
    throw new Error(
      `${filePath} contains invalid JSON.`
    );
  }


  if (!Array.isArray(articles)) {
    throw new Error(
      `${filePath} must contain an array.`
    );
  }


  return {
    articles,
    sha: fileData.sha
  };
}


/*
 * ============================================================
 * GENERIC GITHUB FILE WRITER
 * ============================================================
 */

async function writeJsonFile(
  config,
  filePath,
  articles,
  sha,
  message
) {
  const url =
    `${GITHUB_API}/repos/` +
    `${config.owner}/` +
    `${config.repo}/contents/` +
    `${filePath}`;


  const content =
    Buffer
      .from(
        JSON.stringify(
          articles,
          null,
          2
        ) + "\n",
        "utf8"
      )
      .toString("base64");


  const response =
    await fetch(
      url,
      {
        method: "PUT",

        headers: {
          ...githubHeaders(
            config.token
          ),

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            message,
            content,
            sha,

            branch:
              config.branch
          })
      }
    );


  if (!response.ok) {
    const details =
      await response.text();

    console.error(
      "GitHub write failed:",
      details
    );

    throw new Error(
      `Unable to update ${filePath}: ${response.status}`
    );
  }


  return response.json();
}


/*
 * ============================================================
 * MANUAL NEWS
 * ============================================================
 */

async function readManualNews(
  config
) {
  return readJsonFile(
    config,
    MANUAL_FILE_PATH
  );
}


async function writeManualNews(
  config,
  articles,
  sha,
  message
) {
  return writeJsonFile(
    config,
    MANUAL_FILE_PATH,
    articles,
    sha,
    message
  );
}


/*
 * ============================================================
 * AUTOMATIC NEWS
 * ============================================================
 */

async function readAutomaticNews(
  config
) {
  return readJsonFile(
    config,
    AUTOMATIC_FILE_PATH
  );
}


async function writeAutomaticNews(
  config,
  articles,
  sha,
  message
) {
  return writeJsonFile(
    config,
    AUTOMATIC_FILE_PATH,
    articles,
    sha,
    message
  );
}


/*
 * ============================================================
 * MANUAL ARTICLE VALIDATION
 * ============================================================
 */

function validateManualArticle(article) {
  if (
    !article ||
    typeof article !== "object"
  ) {
    return "Invalid article.";
  }


  const title =
    String(
      article.title || ""
    ).trim();


  if (!title) {
    return "Title is required.";
  }


  const date =
    String(
      article.date || ""
    ).trim();


  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      date
    )
  ) {
    return "A valid date is required.";
  }


  const url =
    String(
      article.url || ""
    ).trim();


  try {
    const parsed =
      new URL(url);

    if (
      parsed.protocol !==
      "https:"
    ) {
      return (
        "Article URL must use HTTPS."
      );
    }

  } catch {
    return "Article URL is invalid.";
  }


  const academicianEn =
    String(
      article.academicianEn ||
      ""
    ).trim();


  if (
    !Object.prototype.hasOwnProperty.call(
      ALLOWED_ACADEMICIANS,
      academicianEn
    )
  ) {
    return (
      "Invalid academician."
    );
  }


  if (
    typeof article.approved !==
    "boolean"
  ) {
    return (
      "Approved must be true or false."
    );
  }


  return null;
}


/*
 * ============================================================
 * MANUAL ARTICLE SANITISATION
 * ============================================================
 */

function sanitiseManualArticle(
  article,
  existingId = null
) {
  const academicianEn =
    String(
      article.academicianEn
    ).trim();


  return {
    id:
      existingId ||
      crypto.randomUUID(),

    title:
      String(
        article.title || ""
      ).trim(),

    titleEn:
      String(
        article.titleEn || ""
      ).trim(),

    date:
      String(
        article.date || ""
      ).trim(),

    category:
      String(
        article.category ||
        "In the Media"
      ).trim(),

    academicianEn,

    academicianEl:
      ALLOWED_ACADEMICIANS[
        academicianEn
      ],

    url:
      String(
        article.url || ""
      ).trim(),

    publisher:
      String(
        article.publisher || ""
      ).trim(),

    domain:
      normaliseDomain(
        article.domain || ""
      ),

    approved:
      article.approved === true,

    manual:
      true
  };
}


/*
 * ============================================================
 * AUTOMATIC ARTICLE VALIDATION
 * ============================================================
 */

function validateAutomaticEdit(body) {
  if (
    !body ||
    typeof body !== "object"
  ) {
    return "Invalid article.";
  }


  const title =
    String(
      body.title || ""
    ).trim();


  const titleEn =
    String(
      body.titleEn || ""
    ).trim();


  if (!title) {
    return (
      "Greek/original title is required."
    );
  }


  if (!titleEn) {
    return (
      "English title is required."
    );
  }


  const sourceTitle =
    String(
      body.sourceTitle || ""
    ).trim();


  const url =
    String(
      body.url || ""
    ).trim();


  /*
   * At least one stable identifier must be supplied.
   *
   * sourceTitle is preferred. URL provides a fallback
   * for older archive items that do not yet contain
   * sourceTitle.
   */
  if (
    !sourceTitle &&
    !url
  ) {
    return (
      "Automatic article identifier is missing."
    );
  }


  return null;
}


/*
 * ============================================================
 * AUTOMATIC ARTICLE EDIT
 * ============================================================
 */

async function updateAutomaticArticle(
  config,
  body
) {
  const validationError =
    validateAutomaticEdit(body);


  if (validationError) {
    return {
      error:
        validationError,

      status:
        400
    };
  }


  const {
    articles,
    sha
  } =
    await readAutomaticNews(
      config
    );


  const requestedSourceTitle =
    String(
      body.sourceTitle || ""
    ).trim();


  const requestedUrl =
    String(
      body.url || ""
    ).trim();


  /*
   * Locate the article.
   *
   * Prefer sourceTitle when it already exists.
   * Fall back to URL for older articles.
   */
  let index = -1;


  if (requestedSourceTitle) {
    index =
      articles.findIndex(
        article =>
          String(
            article.sourceTitle ||
            ""
          ).trim() ===
          requestedSourceTitle
      );
  }


  if (
    index === -1 &&
    requestedUrl
  ) {
    index =
      articles.findIndex(
        article =>
          String(
            article.url || ""
          ).trim() ===
          requestedUrl
      );
  }


  if (index === -1) {
    return {
      error:
        "Automatic article was not found.",

      status:
        404
    };
  }


  const existingArticle =
    articles[index];


  /*
   * IMPORTANT:
   *
   * For older automatic articles sourceTitle does not
   * exist yet. Before changing the visible title, save
   * the existing title as sourceTitle.
   *
   * Once sourceTitle exists it is never changed by the
   * News Admin.
   */
  const preservedSourceTitle =
    String(
      existingArticle.sourceTitle ||
      existingArticle.title ||
      requestedSourceTitle ||
      ""
    ).trim();


  const updatedArticle = {
    ...existingArticle,

    sourceTitle:
      preservedSourceTitle,

    title:
      String(
        body.title || ""
      ).trim(),

    titleEn:
      String(
        body.titleEn || ""
      ).trim()
  };


  articles[index] =
    updatedArticle;


  await writeAutomaticNews(
    config,
    articles,
    sha,
    `Update automatic news headlines: ${updatedArticle.title}`
  );


  return {
    article:
      updatedArticle,

    status:
      200
  };
}


/*
 * ============================================================
 * MAIN HANDLER
 * ============================================================
 */

export default async function handler(
  request
) {
  try {

    /*
     * --------------------------------------------------------
     * CORS PREFLIGHT
     * --------------------------------------------------------
     */
    if (
      request.method.toUpperCase() ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status: 204,
          headers: CORS_HEADERS
        }
      );
    }


    const config =
      getConfig();


    /*
     * --------------------------------------------------------
     * AUTHENTICATION
     * --------------------------------------------------------
     */
    if (
      !isAuthenticated(
        request,
        config.adminPassword
      )
    ) {
      return jsonResponse(
        {
          error:
            "Unauthorized."
        },
        401
      );
    }


    const method =
      request.method.toUpperCase();


    const requestUrl =
      new URL(request.url);


    const newsType =
      String(
        requestUrl.searchParams.get(
          "type"
        ) || "manual"
      )
        .toLowerCase()
        .trim();


    /*
     * ========================================================
     * GET
     * ========================================================
     *
     * Existing behaviour:
     *
     * GET
     * returns manual news.
     *
     * New behaviour:
     *
     * GET ?type=automatic
     * returns automatic news.
     * ========================================================
     */

    if (method === "GET") {

      if (
        newsType ===
        "automatic"
      ) {
        const {
          articles
        } =
          await readAutomaticNews(
            config
          );


        articles.sort(
          (a, b) =>
            new Date(
              b.date || 0
            ) -
            new Date(
              a.date || 0
            )
        );


        return jsonResponse(
          articles
        );
      }


      const {
        articles
      } =
        await readManualNews(
          config
        );


      articles.sort(
        (a, b) =>
          new Date(
            b.date || 0
          ) -
          new Date(
            a.date || 0
          )
      );


      return jsonResponse(
        articles
      );
    }


    /*
     * ========================================================
     * POST
     * ========================================================
     *
     * Add a MANUAL news item.
     * ========================================================
     */

    if (method === "POST") {
      const body =
        await parseBody(
          request
        );


      const validationError =
        validateManualArticle(
          body
        );


      if (validationError) {
        return jsonResponse(
          {
            error:
              validationError
          },
          400
        );
      }


      const {
        articles,
        sha
      } =
        await readManualNews(
          config
        );


      const article =
        sanitiseManualArticle(
          body
        );


      const duplicate =
        articles.some(
          existing =>
            String(
              existing.url || ""
            ).trim() ===
            article.url
        );


      if (duplicate) {
        return jsonResponse(
          {
            error:
              "This article already exists."
          },
          409
        );
      }


      articles.push(
        article
      );


      articles.sort(
        (a, b) =>
          new Date(
            b.date || 0
          ) -
          new Date(
            a.date || 0
          )
      );


      await writeManualNews(
        config,
        articles,
        sha,
        `Add manual news: ${article.title}`
      );


      return jsonResponse(
        article,
        201
      );
    }


    /*
     * ========================================================
     * PUT
     * ========================================================
     *
     * Edit either:
     *
     * 1. A manual article
     * 2. The Greek and English headlines of an
     *    automatic article
     * ========================================================
     */

    if (method === "PUT") {
      const body =
        await parseBody(
          request
        );


      /*
       * ------------------------------------------------------
       * AUTOMATIC NEWS EDIT
       * ------------------------------------------------------
       */
      if (
        newsType ===
        "automatic"
      ) {
        const result =
          await updateAutomaticArticle(
            config,
            body
          );


        if (result.error) {
          return jsonResponse(
            {
              error:
                result.error
            },
            result.status
          );
        }


        return jsonResponse(
          result.article
        );
      }


      /*
       * ------------------------------------------------------
       * MANUAL NEWS EDIT
       * ------------------------------------------------------
       */

      if (!body?.id) {
        return jsonResponse(
          {
            error:
              "Article ID is required."
          },
          400
        );
      }


      const validationError =
        validateManualArticle(
          body
        );


      if (validationError) {
        return jsonResponse(
          {
            error:
              validationError
          },
          400
        );
      }


      const {
        articles,
        sha
      } =
        await readManualNews(
          config
        );


      const index =
        articles.findIndex(
          article =>
            article.id ===
            body.id
        );


      if (index === -1) {
        return jsonResponse(
          {
            error:
              "Article was not found."
          },
          404
        );
      }


      const duplicate =
        articles.some(
          article =>
            article.id !==
              body.id &&

            String(
              article.url || ""
            ).trim() ===

            String(
              body.url || ""
            ).trim()
        );


      if (duplicate) {
        return jsonResponse(
          {
            error:
              "Another article already uses this URL."
          },
          409
        );
      }


      const updatedArticle =
        sanitiseManualArticle(
          body,
          body.id
        );


      articles[index] =
        updatedArticle;


      articles.sort(
        (a, b) =>
          new Date(
            b.date || 0
          ) -
          new Date(
            a.date || 0
          )
      );


      await writeManualNews(
        config,
        articles,
        sha,
        `Update manual news: ${updatedArticle.title}`
      );


      return jsonResponse(
        updatedArticle
      );
    }


    /*
     * ========================================================
     * DELETE
     * ========================================================
     *
     * Delete MANUAL news only.
     *
     * Automatic news cannot be deleted through this
     * endpoint. This prevents an accidental admin action
     * from damaging the automated archive.
     * ========================================================
     */

    if (method === "DELETE") {
      const body =
        await parseBody(
          request
        );


      const id =
        String(
          body?.id || ""
        ).trim();


      if (!id) {
        return jsonResponse(
          {
            error:
              "Article ID is required."
          },
          400
        );
      }


      const {
        articles,
        sha
      } =
        await readManualNews(
          config
        );


      const article =
        articles.find(
          item =>
            item.id === id
        );


      if (!article) {
        return jsonResponse(
          {
            error:
              "Article was not found."
          },
          404
        );
      }


      const updatedArticles =
        articles.filter(
          item =>
            item.id !== id
        );


      await writeManualNews(
        config,
        updatedArticles,
        sha,
        `Delete manual news: ${article.title}`
      );


      return jsonResponse({
        success: true
      });
    }


    /*
     * ========================================================
     * UNSUPPORTED METHOD
     * ========================================================
     */

    return jsonResponse(
      {
        error:
          "Method not allowed."
      },
      405
    );


  } catch (error) {
    console.error(error);


    return jsonResponse(
      {
        error:
          "The admin service encountered an error."
      },
      500
    );
  }
}