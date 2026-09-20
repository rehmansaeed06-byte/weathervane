FROM nginx:alpine

COPY index.html style.css weather.js script.js /usr/share/nginx/html/

EXPOSE 80