FROM cabinlink:release-20261014-study-887f81a
RUN rm -rf /app/dist
COPY dist /app/dist
COPY docker/start.sh /app/start.sh
COPY scripts/start-production.mjs scripts/word-scheduler.mjs /app/scripts/
RUN chmod 755 /app/start.sh
LABEL org.opencontainers.image.revision="ddc7877"
