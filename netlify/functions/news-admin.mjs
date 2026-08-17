import crypto from "node:crypto";

const GITHUB_API =
  "https://api.github.com";

const FILE_PATH =
  "data/manual-news.json";

const ALLOWED_ACADEMICIANS = {
  "Costas Synolakis":
    "Κώστας Συνολάκης",

  "Georgios Marios Karagiannis":
    "Γεώργιος Μάριος Καραγιάννης"
};


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
          "application/json"
      }
    }
  );
}


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


function normaliseDomain(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}


function validateArticle(article) {
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


function sanitiseArticle(
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


async function readManualNews(
  config
) {
  const url =
    `${GITHUB_API}/repos/` +
    `${config.owner}/` +
    `${config.repo}/contents/` +
    `${FILE_PATH}` +
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
      `Unable to read manual news: ${response.status}`
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
      "manual-news.json contains invalid JSON."
    );
  }


  if (!Array.isArray(articles)) {
    throw new Error(
      "manual-news.json must contain an array."
    );
  }


  return {
    articles,
    sha: fileData.sha
  };
}


async function writeManualNews(
  config,
  articles,
  sha,
  message
) {
  const url =
    `${GITHUB_API}/repos/` +
    `${config.owner}/` +
    `${config.repo}/contents/` +
    `${FILE_PATH}`;


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
      `Unable to update manual news: ${response.status}`
    );
  }


  return response.json();
}


async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}


export default async function handler(
  request
) {
  try {
    const config =
      getConfig();


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


    /*
     * GET
     * Return all manual news.
     */
    if (method === "GET") {
      const {
        articles
      } =
        await readManualNews(
          config
        );


      articles.sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );


      return jsonResponse(
        articles
      );
    }


    /*
     * POST
     * Add a manual news item.
     */
    if (method === "POST") {
      const body =
        await parseBody(
          request
        );


      const validationError =
        validateArticle(
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
        sanitiseArticle(
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
          new Date(b.date) -
          new Date(a.date)
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
     * PUT
     * Edit an existing item.
     */
    if (method === "PUT") {
      const body =
        await parseBody(
          request
        );


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
        validateArticle(
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
        sanitiseArticle(
          body,
          body.id
        );


      articles[index] =
        updatedArticle;


      articles.sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
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
     * DELETE
     * Delete an item by ID.
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