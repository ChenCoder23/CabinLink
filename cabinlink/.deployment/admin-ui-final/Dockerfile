FROM cabinlink:release-20261012-admin-ui-c327b07
RUN rm -rf /app/dist
COPY dist /app/dist
COPY docker/start.sh /app/start.sh
RUN chmod 755 /app/start.sh
