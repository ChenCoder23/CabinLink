FROM cabinlink:release-20261013-dashboard-c60c501
RUN rm -rf /app/dist
COPY dist /app/dist
COPY docker/start.sh /app/start.sh
COPY scripts/start-production.mjs scripts/word-scheduler.mjs /app/scripts/
RUN chmod 755 /app/start.sh
LABEL org.opencontainers.image.revision="79b11f1"
