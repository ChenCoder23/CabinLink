FROM cabinlink:release-20261014-outline-175
COPY scripts /app/scripts
HEALTHCHECK --interval=30s --timeout=8s --start-period=120s --retries=3 CMD ["node", "/app/scripts/check-service.mjs"]
LABEL org.opencontainers.image.revision="runtime-recovery-20261029"
