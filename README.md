# voca-metadata-stories
Project for LIS 549 (Cultural Heritage Informatics)

## Web Scraping

We do not publish the raw data because Voca descriptions may be subject to copyright. You can run the Jupyter Notebook in `web_scraping` to get the raw data. It takes under 10 minutes in total in Google Colab.

## Local Development

D3.js does not render directly in the browser due to cybersecurity protections, so you must start a HTTP server to get around this.

```{bash}
python3 -m http.server
```

Upon success, you will be able to see the website by going to the specified port, e.g., `http://[::]:8000/`.

## Deployment

This website is deployed over Github Pages automatically from the `main` branch.