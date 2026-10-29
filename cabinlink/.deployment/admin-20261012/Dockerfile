FROM cabinlink:release-20260929-click-fix
RUN rm -rf /app/dist
COPY dist /app/dist
COPY docker/start.sh /app/start.sh
RUN chmod 755 /app/start.sh
