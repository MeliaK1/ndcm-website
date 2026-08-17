<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>News Admin | Natural Disasters & Crisis Management Research Center</title>

  <link rel="stylesheet" href="styles.css" />

  <style>
    body {
      background: #f5f8fb;
    }

    .admin-shell {
      width: min(1100px, calc(100% - 32px));
      margin: 40px auto;
    }

    .admin-card {
      background: #ffffff;
      border: 1px solid #dce5ec;
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 28px;
      box-shadow: 0 10px 30px rgba(16, 39, 70, 0.06);
    }

    .admin-card h1,
    .admin-card h2 {
      color: #0b2f4f;
      margin-bottom: 18px;
    }

    .admin-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .admin-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .admin-field-full {
      grid-column: 1 / -1;
    }

    .admin-field label {
      font-weight: 700;
      color: #14213d;
    }

    .admin-field input,
    .admin-field select,
    .admin-field textarea {
      width: 100%;
      padding: 11px 12px;
      border: 1px solid #ccd5df;
      border-radius: 8px;
      font: inherit;
      background: #ffffff;
    }

    .admin-field textarea {
      min-height: 90px;
      resize: vertical;
    }

    .admin-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 22px;
    }

    .admin-button {
      padding: 10px 18px;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 700;
    }

    .admin-button-primary {
      background: #0b2f4f;
      color: #ffffff;
    }

    .admin-button-secondary {
      background: #ffffff;
      color: #0b2f4f;
      border: 1px solid #ccd5df;
    }

    .admin-button-danger {
      background: #b42318;
      color: #ffffff;
    }

    .admin-status {
      margin-top: 16px;
      font-weight: 600;
    }

    .admin-news-list {
      display: grid;
      gap: 16px;
    }

    .admin-news-item {
      padding: 18px;
      border: 1px solid #dce5ec;
      border-radius: 12px;
      background: #ffffff;
    }

    .admin-news-item h3 {
      margin: 0 0 8px;
      color: #0b2f4f;
    }

    .admin-news-meta {
      margin: 0 0 10px;
      color: #5c6b7a;
      font-size: 0.9rem;
    }

    .admin-news-item-actions {
      display: flex;
      gap: 10px;
      margin-top: 14px;
      flex-wrap: wrap;
    }

    .admin-login {
      max-width: 460px;
      margin: 80px auto;
    }

    .is-hidden {
      display: none;
    }

    @media (max-width: 700px) {
      .admin-form-grid {
        grid-template-columns: 1fr;
      }

      .admin-field-full {
        grid-column: auto;
      }
    }
  </style>
</head>

<body>

  <div class="admin-shell">

    <!-- LOGIN -->
    <section
      id="loginSection"
      class="admin-card admin-login"
    >
      <h1>News Admin</h1>

      <div class="admin-field">
        <label for="adminPassword">
          Password
        </label>

        <input
          id="adminPassword"
          type="password"
          autocomplete="current-password"
        />
      </div>

      <div class="admin-actions">
        <button
          id="loginButton"
          class="admin-button admin-button-primary"
          type="button"
        >
          Sign in
        </button>
      </div>

      <p
        id="loginStatus"
        class="admin-status"
      ></p>
    </section>


    <!-- ADMIN PANEL -->
    <div
      id="adminPanel"
      class="is-hidden"
    >

      <!-- ADD / EDIT -->
      <section class="admin-card">

        <h2 id="formHeading">
          Add news item
        </h2>

        <form id="newsForm">

          <input
            id="newsId"
            type="hidden"
          />

          <div class="admin-form-grid">

            <div class="admin-field admin-field-full">
              <label for="title">
                Title
              </label>

              <input
                id="title"
                name="title"
                type="text"
                required
              />
            </div>


            <div class="admin-field">
              <label for="date">
                Date
              </label>

              <input
                id="date"
                name="date"
                type="date"
                required
              />
            </div>


            <div class="admin-field">
              <label for="category">
                Category
              </label>

              <input
                id="category"
                name="category"
                type="text"
                value="In the Media"
                required
              />
            </div>


            <div class="admin-field">
              <label for="academician">
                Academician
              </label>

              <select
                id="academician"
                name="academician"
                required
              >
                <option value="">
                  Select
                </option>

                <option value="Costas Synolakis">
                  Costas Synolakis
                </option>

                <option value="Georgios Marios Karagiannis">
                  Georgios Marios Karagiannis
                </option>
              </select>
            </div>


            <div class="admin-field">
              <label for="publisher">
                Publisher
              </label>

              <input
                id="publisher"
                name="publisher"
                type="text"
                required
              />
            </div>


            <div class="admin-field admin-field-full">
              <label for="url">
                Article URL
              </label>

              <input
                id="url"
                name="url"
                type="url"
                placeholder="https://..."
                required
              />
            </div>


            <div class="admin-field">
              <label for="domain">
                Domain
              </label>

              <input
                id="domain"
                name="domain"
                type="text"
                placeholder="example.com"
                required
              />
            </div>


            <div class="admin-field">
              <label for="approved">
                Approved
              </label>

              <select
                id="approved"
                name="approved"
                required
              >
                <option value="true">
                  Yes
                </option>

                <option value="false">
                  No
                </option>
              </select>
            </div>

          </div>


          <div class="admin-actions">

            <button
              class="admin-button admin-button-primary"
              type="submit"
            >
              Save
            </button>

            <button
              id="cancelEditButton"
              class="admin-button admin-button-secondary is-hidden"
              type="button"
            >
              Cancel edit
            </button>

          </div>

          <p
            id="formStatus"
            class="admin-status"
          ></p>

        </form>

      </section>


      <!-- VIEW / EDIT / DELETE -->
      <section class="admin-card">

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:20px;
            flex-wrap:wrap;
          "
        >
          <h2>
            Manual news
          </h2>

          <button
            id="logoutButton"
            class="admin-button admin-button-secondary"
            type="button"
          >
            Sign out
          </button>
        </div>

        <div
          id="manualNewsList"
          class="admin-news-list"
        >
          <p>
            Loading...
          </p>
        </div>

      </section>

    </div>

  </div>


  <script>
    const loginSection =
      document.getElementById("loginSection");

    const adminPanel =
      document.getElementById("adminPanel");

    const adminPassword =
      document.getElementById("adminPassword");

    const loginButton =
      document.getElementById("loginButton");

    const logoutButton =
      document.getElementById("logoutButton");

    const loginStatus =
      document.getElementById("loginStatus");

    const newsForm =
      document.getElementById("newsForm");

    const newsId =
      document.getElementById("newsId");

    const formHeading =
      document.getElementById("formHeading");

    const cancelEditButton =
      document.getElementById("cancelEditButton");

    const formStatus =
      document.getElementById("formStatus");

    const manualNewsList =
      document.getElementById("manualNewsList");


    let sessionPassword = "";
    let manualArticles = [];


    function getAcademicianData(name) {
      if (name === "Costas Synolakis") {
        return {
          academicianEn: "Costas Synolakis",
          academicianEl: "Κώστας Συνολάκης"
        };
      }

      if (
        name ===
        "Georgios Marios Karagiannis"
      ) {
        return {
          academicianEn:
            "Georgios Marios Karagiannis",

          academicianEl:
            "Γεώργιος Μάριος Καραγιάννης"
        };
      }

      return {
        academicianEn: "",
        academicianEl: ""
      };
    }


    function getAuthHeaders() {
      return {
        "Content-Type":
          "application/json",

        "Authorization":
          `Bearer ${sessionPassword}`
      };
    }


    async function apiRequest(
      method,
      body = null
    ) {
      const options = {
        method,
        headers: getAuthHeaders()
      };

      if (body !== null) {
        options.body =
          JSON.stringify(body);
      }

      const response =
        await fetch(
          "/.netlify/functions/news-admin",
          options
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Request failed"
        );
      }

      return data;
    }


    async function login() {
      const password =
        adminPassword.value.trim();

      if (!password) {
        loginStatus.textContent =
          "Enter your password.";

        return;
      }

      sessionPassword =
        password;

      try {
        await loadManualNews();

        loginSection.classList.add(
          "is-hidden"
        );

        adminPanel.classList.remove(
          "is-hidden"
        );

        loginStatus.textContent = "";

      } catch (error) {
        sessionPassword = "";

        loginStatus.textContent =
          "Invalid password.";
      }
    }


    function logout() {
      sessionPassword = "";

      adminPassword.value = "";

      adminPanel.classList.add(
        "is-hidden"
      );

      loginSection.classList.remove(
        "is-hidden"
      );
    }


    async function loadManualNews() {
      const data =
        await apiRequest("GET");

      manualArticles =
        Array.isArray(data)
          ? data
          : [];

      renderManualNews();
    }


    function renderManualNews() {
      if (
        manualArticles.length === 0
      ) {
        manualNewsList.innerHTML =
          "<p>No manual news items yet.</p>";

        return;
      }

      manualNewsList.innerHTML =
        manualArticles
          .map(article => `
            <article
              class="admin-news-item"
            >
              <h3>
                ${escapeHtml(article.title)}
              </h3>

              <p class="admin-news-meta">
                ${escapeHtml(article.date)}
                ·
                ${escapeHtml(
                  article.academicianEn
                )}
                ·
                ${escapeHtml(
                  article.publisher || ""
                )}
              </p>

              <a
                href="${escapeHtml(article.url)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open article
              </a>

              <div
                class="admin-news-item-actions"
              >
                <button
                  class="admin-button admin-button-secondary"
                  type="button"
                  onclick="editArticle('${article.id}')"
                >
                  Edit
                </button>

                <button
                  class="admin-button admin-button-danger"
                  type="button"
                  onclick="deleteArticle('${article.id}')"
                >
                  Delete
                </button>
              </div>
            </article>
          `)
          .join("");
    }


    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }


    function resetForm() {
      newsForm.reset();

      newsId.value = "";

      document.getElementById(
        "category"
      ).value = "In the Media";

      document.getElementById(
        "approved"
      ).value = "true";

      formHeading.textContent =
        "Add news item";

      cancelEditButton.classList.add(
        "is-hidden"
      );

      formStatus.textContent = "";
    }


    function editArticle(id) {
      const article =
        manualArticles.find(
          item => item.id === id
        );

      if (!article) {
        return;
      }

      newsId.value =
        article.id;

      document.getElementById(
        "title"
      ).value =
        article.title || "";

      document.getElementById(
        "date"
      ).value =
        article.date || "";

      document.getElementById(
        "category"
      ).value =
        article.category ||
        "In the Media";

      document.getElementById(
        "academician"
      ).value =
        article.academicianEn || "";

      document.getElementById(
        "publisher"
      ).value =
        article.publisher || "";

      document.getElementById(
        "url"
      ).value =
        article.url || "";

      document.getElementById(
        "domain"
      ).value =
        article.domain || "";

      document.getElementById(
        "approved"
      ).value =
        String(
          article.approved === true
        );

      formHeading.textContent =
        "Edit news item";

      cancelEditButton.classList.remove(
        "is-hidden"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }


    async function deleteArticle(id) {
      const confirmed =
        window.confirm(
          "Delete this news item?"
        );

      if (!confirmed) {
        return;
      }

      try {
        await apiRequest(
          "DELETE",
          { id }
        );

        await loadManualNews();

      } catch (error) {
        alert(error.message);
      }
    }


    newsForm.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        formStatus.textContent =
          "Saving...";

        const academician =
          document.getElementById(
            "academician"
          ).value;

        const academicianData =
          getAcademicianData(
            academician
          );

        const article = {
          id:
            newsId.value || null,

          title:
            document.getElementById(
              "title"
            ).value.trim(),

          date:
            document.getElementById(
              "date"
            ).value,

          category:
            document.getElementById(
              "category"
            ).value.trim(),

          academicianEn:
            academicianData.academicianEn,

          academicianEl:
            academicianData.academicianEl,

          url:
            document.getElementById(
              "url"
            ).value.trim(),

          publisher:
            document.getElementById(
              "publisher"
            ).value.trim(),

          domain:
            document.getElementById(
              "domain"
            ).value.trim(),

          approved:
            document.getElementById(
              "approved"
            ).value === "true"
        };


        try {
          if (article.id) {
            await apiRequest(
              "PUT",
              article
            );
          } else {
            delete article.id;

            await apiRequest(
              "POST",
              article
            );
          }

          formStatus.textContent =
            "Saved successfully.";

          resetForm();

          await loadManualNews();

        } catch (error) {
          formStatus.textContent =
            error.message;
        }
      }
    );


    loginButton.addEventListener(
      "click",
      login
    );


    adminPassword.addEventListener(
      "keydown",
      event => {
        if (event.key === "Enter") {
          login();
        }
      }
    );


    logoutButton.addEventListener(
      "click",
      logout
    );


    cancelEditButton.addEventListener(
      "click",
      resetForm
    );
  </script>

</body>
</html>