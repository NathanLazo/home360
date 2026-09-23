"use client";

import { useState } from "react";
import { LoaderCircleIcon, LocateFixedIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BranchFormErrors, BranchFormValues } from "./branch.types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

type LocationValues = Pick<BranchFormValues, "latitude" | "longitude">;

type GeolocationState = "idle" | "locating" | "denied" | "unavailable";

/** Six decimals ≈ 11 cm: more precision than a storefront needs. */
function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

/**
 * Branch coordinates (radar matching needs a point). The browser location is
 * a shortcut for owners filling the form from the branch itself; manual
 * decimal entry covers everyone else.
 */
export function BranchLocationFields({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: LocationValues;
  errors: BranchFormErrors;
  disabled: boolean;
  onChange: (values: LocationValues) => void;
}) {
  const t = useTranslations("dashboard.branches.form.location");
  const [geo, setGeo] = useState<GeolocationState>("idle");
  const error = errors.latitude ?? errors.longitude;

  function locateCurrentPosition() {
    if (!("geolocation" in navigator)) {
      setGeo("unavailable");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo("idle");
        onChange({
          latitude: formatCoordinate(position.coords.latitude),
          longitude: formatCoordinate(position.coords.longitude),
        });
      },
      (positionError) => {
        setGeo(
          positionError.code === positionError.PERMISSION_DENIED
            ? "denied"
            : "unavailable",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  const status =
    geo === "denied"
      ? t("permissionDenied")
      : geo === "unavailable"
        ? t("unavailable")
        : null;

  return (
    <fieldset className="grid gap-3" aria-describedby="branch-location-help">
      <legend className="mb-3 text-sm leading-none font-medium">
        {t("title")}
      </legend>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p
          id="branch-location-help"
          className="text-muted-foreground text-copy-sm max-w-xs"
        >
          {t("help")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || geo === "locating"}
          onClick={locateCurrentPosition}
        >
          {geo === "locating" ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : (
            <LocateFixedIcon aria-hidden="true" />
          )}
          {t(geo === "locating" ? "locating" : "useCurrent")}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="branch-latitude">{t("latitude")}</Label>
          <Input
            id="branch-latitude"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="28.632996"
            className="font-mono tabular-nums"
            value={values.latitude}
            disabled={disabled}
            aria-invalid={Boolean(errors.latitude)}
            aria-describedby={error ? "branch-location-error" : undefined}
            onChange={(event) =>
              onChange({ ...values, latitude: event.target.value })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="branch-longitude">{t("longitude")}</Label>
          <Input
            id="branch-longitude"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="-106.069100"
            className="font-mono tabular-nums"
            value={values.longitude}
            disabled={disabled}
            aria-invalid={Boolean(errors.longitude)}
            aria-describedby={error ? "branch-location-error" : undefined}
            onChange={(event) =>
              onChange({ ...values, longitude: event.target.value })
            }
          />
        </div>
      </div>
      {error ? (
        <p
          id="branch-location-error"
          role="alert"
          className="text-error-deep text-copy-sm"
        >
          {error}
        </p>
      ) : status ? (
        <p role="status" className="text-muted-foreground text-copy-sm">
          {status}
        </p>
      ) : null}
    </fieldset>
  );
}
