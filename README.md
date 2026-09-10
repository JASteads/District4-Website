# District 4 - Studio Website Development (Version 1.0)

<img width="1920" height="985" alt="image" src="https://github.com/user-attachments/assets/bbe34718-bdbb-4897-8204-f71a8b98f8c5" />


**This repo contains the non-sensitive raw source code of the District 4 Website.** It hosts news & announcements, a concept art gallery, and an interactive product library for all things District 4.

## Essential Information
**Live URL**: [District 4 Website](https://district4-website.onrender.com/)

**Sample Images**: [District 4 Sample Images](https://github.com/JASteads/District4-Website/tree/main/Sample%20Images)

**Environmental Variables**: `VITE_API_URL`, `DB_CONNECTION_STRING`, `DEV_MODE`, `DEV_HOST`, `PROD_HOST`

> [!IMPORTANT]
> To compile scripts and web pages, run `npm run build` from the root folder on a local terminal, or `build` on a Windows OS.
> 
> To run the dev environment on a browser, run `npm run dev` from the root folder on a local terminal. Note that data retrieval will not work (server access is private).

## Key Features
**Vite + Express + Postgres suite** — The website uses Vite as its frontend UI compiler with Typescript, Express for API routing, and Postgres to communicate with the website's online database.

**User authentication** — Users can register to gain access to their own account on the website, with hashed password protection and session tokens for each device signed into. Benefits to having an account will be expanded upon over time.

**Admin CMS** — Given this is not a social media platform, administrative privileges are used for handling website content. A user must be signed into an administrator account in order to access these exclusive features.

## Content Creation Tools
<img width="2560" height="1305" alt="image" src="https://github.com/user-attachments/assets/9f92deb2-cb4a-4861-9bc9-4661f5284d40" />

Admins have access to the following tools:
* An admin panel for managing all content on the website. Items can be viewed, edited, and deleted all from the same panel
* A suite of editors designed with scalability in mind. Editors extend a base abstract class to ensure common functionality is consistent across all editors. New editors can be implemented and configured with ease
* A custom parsing tool for news articles that works straight from the editor. The parser is made from scratch with nested formatting possible
* An upload portal for all content types available on the website

## Access My Portfolio Online
Navigate to the [Portfolio Page](https://district4-website.onrender.com/portfolio.html) from the website to access the hidden portfolio page. This page is hidden because its contents are not relevant to the website, but should still be accessible online.
