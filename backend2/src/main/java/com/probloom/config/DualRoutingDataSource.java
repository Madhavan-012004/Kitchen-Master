package com.probloom.config;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

/**
 * Routes database connections to either the embedded (offline) PostgreSQL
 * or the cloud (online) PostgreSQL based on DataSourceModeHolder.
 */
public class DualRoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        return DataSourceModeHolder.getMode();
    }
}
