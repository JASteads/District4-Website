# District 4 - Studio Website Development (Version 1.0)

**This repo contains the non-sensitive raw source code of the District 4 Website.** It hosts news & announcements, a concept art gallery, and an interactive product library for all things District 4.

## Key Features
**Vite + Express + Postgres suite** — The website uses Vite as its frontend UI compiler with Typescript, Express for API routing, and Postgres to communicate with the website's online database.

**User authentication** — Users can register to gain access to their own account on the website, with hashed password protection and session tokens for each device signed into. Benefits to having an account will be expanded upon over time.

**Admin CMS** — Given this is not a social media platform, administrative privileges are used for handling website content. A user must be signed into an administrator account in order to access these exclusive features.

## Content Creation Tools
Admins have access to the following tools:
* An admin panel for managing all content on the website. Items can be viewed, edited, and deleted all from the same panel
* A suite of editors designed with scalability in mind. Editors extend a base abstract class to ensure common functionality is consistent across all editors. New editors can be implemented and configured with ease
* A custom parsing tool for news articles that works straight from the editor. The parser is made from scratch with nested formatting possible
* An upload portal for all content types available on the website

## Access My Portfolio Online
Navigate to the 'portfolio.html' page from the website to access the hidden portfolio page. This page is hidden because its contents are not relevant to the website, but should still be accessible online.
