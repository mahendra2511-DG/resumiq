/* Resumiq project helper: bullet ideas based on the tools a student used. Ideas are prompts, not facts:
   the student ticks only what they really did and fills the [placeholders] with real numbers. */
(function () {
  "use strict";
  const T = [
    [/\b(sql|mysql|postgres|postgresql|sql server|t-sql|oracle|sqlite|bigquery|snowflake)\b/i, "SQL", [
      "Wrote [N] SQL queries using joins, CTEs and window functions to answer [N] business questions on [dataset]",
      "Cleaned and transformed [N] rows of raw data in SQL (duplicates, nulls, data types) before analysis",
      "Calculated KPIs such as [revenue / retention / conversion] by [month / region / segment] with SQL aggregations",
      "Optimised slow SQL queries with indexes and CTEs, cutting run time from [X] to [Y] seconds"]],
    [/\bexcel|spreadsheet|google sheets\b/i, "Excel", [
      "Built an interactive Excel dashboard with pivot tables, slicers and charts tracking [N] KPIs",
      "Cleaned [N] rows in Excel using Power Query, XLOOKUP and conditional formatting",
      "Automated a [weekly / monthly] report in Excel, reducing preparation time from [X] hours to [Y]"]],
    [/\bpower ?bi\b/i, "Power BI", [
      "Designed a star-schema data model with [N] fact and [N] dimension tables in Power BI",
      "Created [N] DAX measures (YoY growth, running totals, % share) for [KPIs]",
      "Built a [N]-page Power BI report with drill-through, bookmarks and slicers by [region / product / time]",
      "Published the report to Power BI Service with scheduled refresh and row-level security for [N] users"]],
    [/\bdax\b/i, "DAX", ["Wrote time-intelligence DAX measures (MTD, QTD, YTD, YoY %) to compare performance across [periods]"]],
    [/\bpower query\b/i, "Power Query", ["Combined [N] source files with Power Query and built a repeatable cleaning pipeline"]],
    [/\btableau\b/i, "Tableau", [
      "Built a Tableau dashboard with LOD expressions, parameters and actions to analyse [topic]",
      "Created calculated fields and table calculations for [KPIs] across [N] dimensions",
      "Designed a Tableau story of [N] views presenting key findings and recommendations to [audience]"]],
    [/\bpython\b/i, "Python", [
      "Cleaned and analysed [N] records in Python (Pandas), handling missing values, outliers and data types",
      "Performed exploratory data analysis in Python and found [N] key patterns in [topic]",
      "Automated [data collection / cleaning / reporting] with a Python script, saving [X] hours per run"]],
    [/\bpandas|numpy\b/i, "Pandas", ["Merged and reshaped [N] datasets with Pandas (merge, groupby, pivot) into an analysis-ready table"]],
    [/\bmatplotlib|seaborn|plotly\b/i, "Visualisation", ["Visualised trends and distributions with [Matplotlib / Seaborn] charts to explain [finding]"]],
    [/\bstatistic|hypothesis|a\/b|t-test|regression\b/i, "Statistics", [
      "Ran [t-test / chi-square / A/B test] to check whether [change] had a significant effect on [metric]",
      "Built a regression model to estimate the impact of [factor] on [metric] (R² = [X])"]],
    [/\bscikit|sklearn|machine learning|xgboost|random forest|logistic\b/i, "Machine learning", [
      "Trained a [model] to predict [target], reaching [X]% accuracy vs a [Y]% baseline",
      "Engineered [N] features and tuned hyper-parameters with cross-validation to improve [metric] by [X]%",
      "Explained model results with feature importance and turned them into [N] business actions"]],
    [/\bdeep learning|pytorch|tensorflow|keras|cnn|computer vision\b/i, "Deep learning", ["Trained a [CNN / transformer] on [N] images / texts, achieving [X]% accuracy on the test set"]],
    [/\bllm|openai|gpt|langchain|rag|gemini|grok|prompt\b/i, "LLM / GenAI", [
      "Built a [RAG / chatbot] over [N] documents using [LangChain / OpenAI API] and a vector database",
      "Created an evaluation set of [N] questions and improved answer accuracy from [X]% to [Y]%",
      "Reduced response cost / latency by [X]% with caching and prompt changes"]],
    [/\bspark|pyspark|databricks|hadoop\b/i, "Spark", ["Processed [N] GB of data with PySpark, cutting job run time from [X] to [Y] minutes"]],
    [/\bairflow|dbt|etl|elt|ssis|informatica|data factory\b/i, "Data pipelines", ["Built an ETL pipeline with [Airflow / dbt / ADF] loading [N] sources into a warehouse on a [daily] schedule"]],
    [/\baws|azure|gcp|cloud\b/i, "Cloud", ["Deployed the [app / pipeline / model] on [AWS / Azure / GCP] for [N] users / runs per day"]],
    [/\bdocker|kubernetes|ci\/cd|github actions|jenkins\b/i, "DevOps", ["Containerised the project with Docker and set up CI/CD that runs [N] tests on every push"]],
    [/\breact|next\.?js|angular|vue|html|css|javascript|typescript\b/i, "Frontend", ["Built a responsive [React] interface with [N] screens, used by [N] users"]],
    [/\bnode|express|django|flask|fastapi|spring|rest api\b/i, "Backend", ["Built a REST API with [framework] exposing [N] endpoints, with authentication and input validation"]],
    [/\bgit|github\b/i, "GitHub", ["Published the project on GitHub with a clear README, data dictionary and screenshots"]],
    [/\bjira|confluence|agile|scrum\b/i, "Agile", ["Planned the project in [JIRA] across [N] sprints and tracked [N] user stories to completion"]],
    [/\bfigma|wireframe|ux|ui\b/i, "Design", ["Designed [N] wireframes and a clickable prototype in Figma, tested with [N] users"]],
    [/\bgoogle analytics|ga4|seo|google ads|meta ads\b/i, "Marketing analytics", ["Analysed [campaign / website] data in [GA4] and recommended changes that could lift [conversion] by [X]%"]],
  ];
  const GENERIC = ["Defined the business problem and [N] KPIs with [stakeholders / mentor] before starting the analysis", "Presented [N] insights and [N] recommendations to [audience / batch / panel]"];
  // returns [{tool, text}] for the given tools and title (unique, max n)
  function forProject(tools, title, n) {
    const hay = String(tools || "") + " " + String(title || ""); const out = [], seen = new Set();
    T.forEach(([re, tool, list]) => { if (re.test(hay)) list.forEach(t => { if (!seen.has(t)) { seen.add(t); out.push({ tool, text: t }); } }); });
    if (out.length) GENERIC.forEach(t => out.push({ tool: "General", text: t }));
    return out.slice(0, n || 14);
  }
  window.RQ_IDEAS = { forProject };
})();
