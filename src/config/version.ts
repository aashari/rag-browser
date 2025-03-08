export const VERSION = "2.2.0";

// Semantic version components
export const [MAJOR, MINOR, PATCH] = VERSION.split(".").map(Number);

// Version with prefix for git tags
export const GIT_VERSION = `v${VERSION}`;

// Package name for npm
export const PACKAGE_NAME = "rag-browser";
