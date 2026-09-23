"use client";

import { useState } from "react";
import { LoaderCircleIcon, LocateFixedIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export type GeoCoordinateValues = {
  latitude: string;
  longitude: string;
};

export type GeoCoordinateErrors = {
  latitude?: string;
  longitude?: string;
};

type GeolocationState = "idle" | "locating" | "denied" | "unavailable";

/** Six decimals ≈ 11 cm: more precision than a storefront needs. */
function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

/**
 * Latitude/longitude pair shared by every form that places something on the
 * request radar (business branches, corporate locations). The browser
 * location is a shortcut for people filling the form on site; manual decimal
 * entry covers everyone else. `idPrefix` keeps input ids unique per form so
 * callers can focus `${idPrefix}-latitude` / `${idPrefix}-longitude`.
 */
export function GeoCoordinateFields({
  idPrefix,
  values,
  errors,
  disabled,
  onChange,
}: {
  idPrefix: string;
  values: GeoCoordinateValues;
  errors: GeoCoordinateErrors;
  disabled: boolean;
  onChange: (values: GeoCoordinateValues) => void;
}) {
  const t = useTranslations("common.geoLocation");
  const [geo, setGeo] = useState<GeolocationState>("idle");
  const error = errors.latitude ?? errors.longitude;
  const helpId = `${idPrefix}-location-help`;
  const errorId = `${idPrefix}-location-error`;

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
    <fieldset className="grid gap-3" aria-describedby={helpId}>
      <legend className="mb-3 text-sm leading-none font-medium">
        {t("title")}
      </legend>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p id={helpId} className="text-muted-foreground text-copy-sm max-w-xs">
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
          <Label htmlFor={`${idPrefix}-latitude`}>{t("latitude")}</Label>
          <Input
            id={`${idPrefix}-latitude`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="28.632996"
            className="font-mono tabular-nums"
            value={values.latitude}
            disabled={disabled}
            aria-invalid={Boolean(errors.latitude)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) =>
              onChange({ ...values, latitude: event.target.value })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-longitude`}>{t("longitude")}</Label>
          <Input
            id={`${idPrefix}-longitude`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="-106.069100"
            className="font-mono tabular-nums"
            value={values.longitude}
            disabled={disabled}
            aria-invalid={Boolean(errors.longitude)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) =>
              onChange({ ...values, longitude: event.target.value })
            }
          />
        </div>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-error-deep text-copy-sm">
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
