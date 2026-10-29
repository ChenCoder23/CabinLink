FROM cabinlink:release-20261012-wordbook-5ecd46f
RUN rm -rf /app/dist
COPY dist /app/dist
COPY docker/start.sh /app/start.sh
RUN chmod 755 /app/start.sh
LABEL org.opencontainers.image.revision="f480cc0"
