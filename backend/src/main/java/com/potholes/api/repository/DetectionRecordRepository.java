package com.potholes.api.repository;

import com.potholes.api.entity.DetectionRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DetectionRecordRepository extends JpaRepository<DetectionRecord, Long> {
    List<DetectionRecord> findTop2000ByPotholeDetectedTrueAndLatitudeIsNotNullAndLongitudeIsNotNullOrderByTimestampDesc();
}
