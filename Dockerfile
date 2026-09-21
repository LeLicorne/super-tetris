FROM nginx:alpine

# Supprime la page Nginx par défaut
RUN rm -rf /usr/share/nginx/html/*

# Copie le site
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]