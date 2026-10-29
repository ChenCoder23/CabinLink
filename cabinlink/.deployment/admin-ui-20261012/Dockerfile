FROM cabinlink:release-20261012-admin-v1
RUN rm -rf /app/dist
COPY dist /app/dist
COPY docker/start.sh /app/start.sh
RUN chmod 755 /app/start.sh
