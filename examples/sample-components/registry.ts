import { createComponentRegistry } from "@agidn/component-registry";
import { BadgeDefinition } from "./Badge.ui.js";
import { ButtonDefinition } from "./Button.ui.js";
import { CardDefinition } from "./Card.ui.js";
import { ContainerDefinition } from "./Container.ui.js";
import { FAQItemDefinition } from "./FAQItem.ui.js";
import { GridDefinition } from "./Grid.ui.js";
import { HeadingDefinition } from "./Heading.ui.js";
import { IconDefinition } from "./Icon.ui.js";
import { ImageDefinition } from "./Image.ui.js";
import { LinkDefinition } from "./Link.ui.js";
import { NavigationDefinition } from "./Navigation.ui.js";
import { PricingCardDefinition } from "./PricingCard.ui.js";
import { RowDefinition } from "./Row.ui.js";
import { StackDefinition } from "./Stack.ui.js";
import { TextDefinition } from "./Text.ui.js";

export const sampleComponentRegistry = createComponentRegistry([
  ButtonDefinition, LinkDefinition, HeadingDefinition, TextDefinition, ImageDefinition,
  IconDefinition, BadgeDefinition, CardDefinition, NavigationDefinition, ContainerDefinition,
  StackDefinition, RowDefinition, GridDefinition, PricingCardDefinition, FAQItemDefinition
]);
