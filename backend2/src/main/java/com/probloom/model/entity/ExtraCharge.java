package com.probloom.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExtraCharge {

    @Column(name = "charge_name", nullable = false)
    private String name;

    @Column(name = "charge_amount", nullable = false)
    private Double amount;
}
