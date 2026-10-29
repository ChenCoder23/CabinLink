FROM cabinlink:release-20261012-glass-f480cc0
RUN rm -rf /app/dist
COPY dist /app/dist
COPY docker/start.sh /app/start.sh
COPY scripts/start-production.mjs scripts/word-scheduler.mjs /app/scripts/
RUN chmod 755 /app/start.sh
LABEL org.opencontainers.image.revision="ebb95cd"
