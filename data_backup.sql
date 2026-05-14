--
-- PostgreSQL database dump
--

\restrict ljTaxG4xfosFjGf8rq5riC0bKi54a9r1dERovVtXFEiLo7dRff2lwhfgZxeiZ5z

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance (
    id bigint NOT NULL,
    check_in_time timestamp(6) without time zone NOT NULL,
    check_out_time timestamp(6) without time zone,
    created_at timestamp(6) without time zone,
    date character varying(10) NOT NULL,
    disconnected_at timestamp(6) without time zone,
    last_ping_time timestamp(6) without time zone,
    status character varying(255),
    total_hours double precision,
    updated_at timestamp(6) without time zone,
    employee_id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    latitude double precision,
    longitude double precision,
    CONSTRAINT attendance_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'COMPLETED'::character varying, 'DISCONNECTED'::character varying])::text[])))
);


ALTER TABLE public.attendance OWNER TO postgres;

--
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_id_seq OWNER TO postgres;

--
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id bigint NOT NULL,
    created_at timestamp(6) without time zone,
    email character varying(255),
    last_visit timestamp(6) without time zone,
    name character varying(255) NOT NULL,
    phone character varying(255) NOT NULL,
    total_visits integer,
    updated_at timestamp(6) without time zone,
    restaurant_id bigint NOT NULL
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_items (
    id bigint NOT NULL,
    category character varying(255),
    cost_per_unit double precision,
    created_at timestamp(6) without time zone,
    current_stock double precision NOT NULL,
    is_active boolean,
    last_restocked_at timestamp(6) without time zone,
    low_stock_threshold double precision NOT NULL,
    name character varying(255) NOT NULL,
    supplier_name character varying(255),
    supplier_phone character varying(255),
    unit character varying(255) NOT NULL,
    updated_at timestamp(6) without time zone,
    restaurant_id bigint NOT NULL,
    barcode character varying(255),
    is_billiable boolean,
    price double precision,
    CONSTRAINT inventory_items_unit_check CHECK (((unit)::text = ANY ((ARRAY['KG'::character varying, 'G'::character varying, 'LITRE'::character varying, 'ML'::character varying, 'PIECE'::character varying, 'DOZEN'::character varying, 'PACK'::character varying, 'BOTTLE'::character varying])::text[])))
);


ALTER TABLE public.inventory_items OWNER TO postgres;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_items_id_seq OWNER TO postgres;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: item_ingredients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.item_ingredients (
    id bigint NOT NULL,
    inventory_item_name character varying(255),
    quantity_used double precision NOT NULL,
    unit character varying(255),
    inventory_item_id bigint,
    menu_item_id bigint NOT NULL
);


ALTER TABLE public.item_ingredients OWNER TO postgres;

--
-- Name: item_ingredients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.item_ingredients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.item_ingredients_id_seq OWNER TO postgres;

--
-- Name: item_ingredients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.item_ingredients_id_seq OWNED BY public.item_ingredients.id;


--
-- Name: menu_item_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_item_tags (
    menu_item_id bigint NOT NULL,
    tag character varying(255)
);


ALTER TABLE public.menu_item_tags OWNER TO postgres;

--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_items (
    id bigint NOT NULL,
    category character varying(255) NOT NULL,
    created_at timestamp(6) without time zone,
    description text,
    image_url character varying(255),
    is_available boolean,
    is_veg boolean,
    name character varying(255) NOT NULL,
    preparation_time integer,
    price double precision NOT NULL,
    sort_order integer,
    tax_rate double precision,
    updated_at timestamp(6) without time zone,
    restaurant_id bigint NOT NULL,
    is_recommended boolean,
    order_count bigint,
    tamil_description text,
    tamil_name character varying(255)
);


ALTER TABLE public.menu_items OWNER TO postgres;

--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_items_id_seq OWNER TO postgres;

--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: order_extra_charges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_extra_charges (
    order_id bigint NOT NULL,
    charge_amount double precision NOT NULL,
    charge_name character varying(255) NOT NULL
);


ALTER TABLE public.order_extra_charges OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id bigint NOT NULL,
    added_by_name character varying(255),
    category character varying(255),
    name character varying(255) NOT NULL,
    notes text,
    price double precision NOT NULL,
    quantity integer NOT NULL,
    status character varying(255),
    tax_rate double precision,
    added_by bigint,
    menu_item_id bigint,
    order_id bigint NOT NULL,
    completed_quantity integer,
    barcode character varying(255),
    inventory_item_id bigint
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id bigint NOT NULL,
    bill_printed boolean,
    bill_requested boolean,
    bill_requested_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone,
    customer_name character varying(255),
    customer_phone character varying(255),
    discount_amount double precision,
    discount_type character varying(255),
    discount_value double precision,
    is_offline boolean,
    kot_printed_at timestamp(6) without time zone,
    notes text,
    offline_id character varying(255),
    order_number character varying(255) NOT NULL,
    order_type character varying(255),
    payment_method character varying(255),
    payment_status character varying(255),
    status character varying(255) NOT NULL,
    subtotal double precision NOT NULL,
    synced_at timestamp(6) without time zone,
    table_number character varying(255),
    tax_amount double precision,
    token_number character varying(255),
    total double precision NOT NULL,
    updated_at timestamp(6) without time zone,
    waiter_name character varying(255),
    created_by bigint,
    restaurant_id bigint NOT NULL,
    merged_tables character varying(255),
    covers integer,
    CONSTRAINT orders_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['PERCENTAGE'::character varying, 'FLAT'::character varying, 'NONE'::character varying])::text[]))),
    CONSTRAINT orders_order_type_check CHECK (((order_type)::text = ANY ((ARRAY['DINE_IN'::character varying, 'TAKEAWAY'::character varying])::text[]))),
    CONSTRAINT orders_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['CASH'::character varying, 'CARD'::character varying, 'UPI'::character varying, 'PENDING'::character varying])::text[]))),
    CONSTRAINT orders_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['UNPAID'::character varying, 'PAID'::character varying, 'PARTIAL'::character varying])::text[]))),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PREPARING'::character varying, 'READY'::character varying, 'SERVED'::character varying, 'PAID'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: queue_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.queue_entries (
    id bigint NOT NULL,
    allocated_table character varying(255),
    created_at timestamp(6) without time zone,
    customer_name character varying(255) NOT NULL,
    customer_phone character varying(255) NOT NULL,
    party_size integer NOT NULL,
    status character varying(255) NOT NULL,
    token_number character varying(255) NOT NULL,
    updated_at timestamp(6) without time zone,
    restaurant_id bigint NOT NULL,
    CONSTRAINT queue_entries_status_check CHECK (((status)::text = ANY ((ARRAY['WAITING'::character varying, 'CALLED'::character varying, 'SEATED'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE public.queue_entries OWNER TO postgres;

--
-- Name: queue_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.queue_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.queue_entries_id_seq OWNER TO postgres;

--
-- Name: queue_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.queue_entries_id_seq OWNED BY public.queue_entries.id;


--
-- Name: stakeholder_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stakeholder_mappings (
    id bigint NOT NULL,
    assigned_at timestamp(6) without time zone,
    is_active boolean,
    share_percentage double precision,
    restaurant_id bigint NOT NULL,
    stakeholder_id bigint NOT NULL
);


ALTER TABLE public.stakeholder_mappings OWNER TO postgres;

--
-- Name: stakeholder_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stakeholder_mappings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stakeholder_mappings_id_seq OWNER TO postgres;

--
-- Name: stakeholder_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stakeholder_mappings_id_seq OWNED BY public.stakeholder_mappings.id;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    id bigint NOT NULL,
    quantity double precision NOT NULL,
    reason character varying(255),
    "timestamp" timestamp(6) without time zone,
    type character varying(255) NOT NULL,
    inventory_item_id bigint NOT NULL,
    order_id bigint,
    performed_by bigint,
    movement_timestamp timestamp(6) without time zone,
    restaurant_id bigint,
    CONSTRAINT stock_movements_type_check CHECK (((type)::text = ANY ((ARRAY['ADD'::character varying, 'DEDUCT'::character varying, 'ADJUST'::character varying])::text[])))
);


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_movements_id_seq OWNER TO postgres;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id bigint NOT NULL,
    amount double precision NOT NULL,
    category character varying(255) NOT NULL,
    date timestamp(6) without time zone NOT NULL,
    description character varying(255),
    payment_method character varying(255),
    reference_id character varying(255),
    type character varying(255) NOT NULL,
    restaurant_id bigint NOT NULL,
    CONSTRAINT transactions_type_check CHECK (((type)::text = ANY ((ARRAY['INCOME'::character varying, 'EXPENSE'::character varying])::text[])))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_assigned_tables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_assigned_tables (
    user_id bigint NOT NULL,
    table_number character varying(255)
);


ALTER TABLE public.user_assigned_tables OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    address character varying(255),
    created_at timestamp(6) without time zone,
    currency character varying(255),
    email character varying(255) NOT NULL,
    geofence_radius double precision,
    is_active boolean,
    latitude double precision,
    logo character varying(255),
    longitude double precision,
    name character varying(50) NOT NULL,
    onboarding_completed boolean,
    onboarding_step integer,
    password character varying(255) NOT NULL,
    phone character varying(255),
    restaurant_name character varying(255) NOT NULL,
    role character varying(255) NOT NULL,
    subscription_active boolean,
    subscription_expires_at timestamp(6) without time zone,
    subscription_plan character varying(255),
    subscription_started_at timestamp(6) without time zone,
    tax_rate double precision,
    updated_at timestamp(6) without time zone,
    parent_owner_id bigint,
    total_tables integer,
    otp character varying(255),
    otp_expires_at timestamp(6) without time zone,
    gst_number character varying(255),
    allow_no_stock_sale boolean,
    auto_print_enabled boolean,
    bill_printer_enabled boolean,
    category_printer_enabled boolean,
    consolidated_receipt boolean,
    item_wise_kot boolean,
    kot_printer_enabled boolean,
    large_font_kot boolean,
    low_stock_alert boolean,
    manual_quantity boolean,
    menu_color_style character varying(255),
    menu_item_column_count integer,
    menu_layout character varying(255),
    min_print_price double precision,
    print_count integer,
    quick_mode boolean,
    reprint_bill boolean,
    reprint_kot boolean,
    track_customer_detail boolean,
    online_auto_accept boolean,
    online_auto_print boolean,
    online_notification boolean,
    online_print_counter boolean,
    online_print_kitchen boolean,
    online_stock_activate_time boolean,
    whatsapp_country_code character varying(255),
    whatsapp_detailed_bill boolean,
    counter_printer_ip character varying(255),
    kitchen_printer_ip character varying(255),
    ac_charge_percentage double precision,
    ac_tables character varying(255),
    table_metadata text,
    table_categories text,
    is_probloom_admin boolean,
    license_key text,
    license_type character varying(255),
    preferred_pos_mode character varying(255),
    preferred_language character varying(255),
    print_language character varying(255),
    accent_color character varying(255),
    is_approved boolean,
    business_type character varying(255),
    outlets_count character varying(255),
    requested_plan character varying(255),
    temp_password character varying(255),
    CONSTRAINT users_subscription_plan_check CHECK (((subscription_plan)::text = ANY ((ARRAY['FREE'::character varying, 'PRO'::character varying, 'ENTERPRISE'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: item_ingredients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_ingredients ALTER COLUMN id SET DEFAULT nextval('public.item_ingredients_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: queue_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_entries ALTER COLUMN id SET DEFAULT nextval('public.queue_entries_id_seq'::regclass);


--
-- Name: stakeholder_mappings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stakeholder_mappings ALTER COLUMN id SET DEFAULT nextval('public.stakeholder_mappings_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance (id, check_in_time, check_out_time, created_at, date, disconnected_at, last_ping_time, status, total_hours, updated_at, employee_id, restaurant_id, latitude, longitude) FROM stdin;
1	2026-03-19 10:23:19.438232	2026-03-19 10:25:32.063568	2026-03-19 10:23:19.453973	2026-03-19	\N	2026-03-19 10:23:19.438232	COMPLETED	0.03	2026-03-19 10:25:32.065762	2	1	11.0684516	78.7810829
2	2026-03-19 10:25:52.399124	2026-03-19 10:27:58.41216	2026-03-19 10:25:52.400652	2026-03-19	\N	2026-03-19 10:25:52.399124	COMPLETED	0.03	2026-03-19 10:27:58.412159	2	1	11.0684516	78.7810829
3	2026-03-19 10:36:22.936695	2026-03-19 22:49:24.13882	2026-03-19 10:36:22.936694	2026-03-19	\N	2026-03-19 10:36:22.936695	COMPLETED	12.22	2026-03-19 22:49:24.208136	2	1	11.0684516	78.7810829
4	2026-03-20 14:38:23.530222	2026-03-20 14:38:23.814323	2026-03-20 14:38:23.552718	2026-03-20	\N	2026-03-20 14:38:23.530222	COMPLETED	0	2026-03-20 14:38:23.818549	2	1	10.8242526	78.6834117
5	2026-03-20 14:38:33.578667	2026-03-20 15:11:46.91397	2026-03-20 14:38:33.582803	2026-03-20	\N	2026-03-20 14:38:33.578667	COMPLETED	0.55	2026-03-20 15:11:46.933291	2	1	10.824922	78.6861412
6	2026-03-20 16:39:58.293195	\N	2026-03-20 16:39:58.312698	2026-03-20	\N	2026-03-20 16:39:58.293195	ACTIVE	0	2026-03-20 16:39:58.312698	2	1	10.8242815	78.6834348
7	2026-03-21 16:49:01.536883	\N	2026-03-21 16:49:01.547647	2026-03-21	\N	2026-03-21 16:49:01.536883	ACTIVE	0	2026-03-21 16:49:01.547647	2	1	11.0684389	78.7810851
8	2026-03-25 16:12:49.121041	\N	2026-03-25 16:12:49.153078	2026-03-25	\N	2026-03-25 16:12:49.123114	ACTIVE	0	2026-03-25 16:12:49.153078	2	1	11.0684379	78.7810863
9	2026-04-15 11:32:07.74952	2026-04-15 11:39:56.834463	2026-04-15 11:32:07.864297	2026-04-15	\N	2026-04-15 11:32:07.74952	COMPLETED	0.12	2026-04-15 11:39:56.834463	2	1	11.0887081	76.9414396
10	2026-04-15 11:40:04.203537	2026-04-15 16:11:19.273322	2026-04-15 11:40:04.203536	2026-04-15	\N	2026-04-15 11:40:04.203537	COMPLETED	4.52	2026-04-15 16:11:19.330766	2	1	11.088759	76.941388
11	2026-05-02 07:50:27.807164	2026-05-02 08:27:59.395809	2026-05-02 07:50:27.826299	2026-05-02	\N	2026-05-02 07:50:27.807164	COMPLETED	0.62	2026-05-02 08:27:59.402254	2	1	11.0685444	78.7815395
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, created_at, email, last_visit, name, phone, total_visits, updated_at, restaurant_id) FROM stdin;
1	2026-03-31 20:55:32.318199	\N	2026-03-31 21:52:05.889102	Joe	9710082916	3	2026-03-31 21:52:05.90305	1
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_items (id, category, cost_per_unit, created_at, current_stock, is_active, last_restocked_at, low_stock_threshold, name, supplier_name, supplier_phone, unit, updated_at, restaurant_id, barcode, is_billiable, price) FROM stdin;
11	Personal Care	0	2026-03-26 23:16:43.037645	60	f	\N	10	Dabur Red Paste 200g	\N	\N	PIECE	2026-03-26 23:42:34.131608	1	8901207011683	t	110
13	Snacks	0	2026-03-26 23:16:43.128374	45	f	\N	10	Parle-G Gold 1kg	\N	\N	PIECE	2026-03-26 23:42:34.945233	1	8901719227184	t	150
17	Grocery	0	2026-03-26 23:31:27.975639	50	f	\N	10	Aashirvaad Shudh Chakki Atta 5kg	\N	\N	PIECE	2026-03-26 23:36:53.162822	1	8901725132274	t	250
2	Grocery	0	2026-03-26 23:16:41.961795	50	f	\N	10	Aashirvaad Shudh Chakki Atta 5kg	\N	\N	PIECE	2026-03-26 23:42:32.927013	1	8901725132274	t	250
20	Dairy	0	2026-03-26 23:31:28.304846	20	f	\N	10	Amul Butter Pasteurized 500g	\N	\N	PIECE	2026-03-26 23:42:33.331766	1	8901262010011	t	255
5	Dairy	0	2026-03-26 23:16:42.692234	20	f	\N	10	Amul Butter Pasteurized 500g	\N	\N	PIECE	2026-03-26 23:42:33.491404	1	8901262010011	t	255
9	Snacks	0	2026-03-26 23:16:42.905662	40	f	\N	10	Britannia Good Day Cashew 600g	\N	\N	PIECE	2026-03-26 23:42:33.638008	1	8901063140594	t	120
24	Snacks	0	2026-03-26 23:31:28.479903	40	f	\N	10	Britannia Good Day Cashew 600g	\N	\N	PIECE	2026-03-26 23:42:33.716956	1	8901063140594	t	120
30	Beverages	0	2026-03-26 23:31:28.727008	20	f	\N	10	Brooke Bond Red Label Tea 500g	\N	\N	PIECE	2026-03-26 23:42:33.795468	1	8901030006267	t	260
15	Beverages	0	2026-03-26 23:16:43.20703	20	f	\N	10	Brooke Bond Red Label Tea 500g	\N	\N	PIECE	2026-03-26 23:42:33.871174	1	8901030006267	t	260
25	Beverages	0	2026-03-26 23:31:28.522498	35	f	\N	10	Coca-Cola Original Taste 2L	\N	\N	PIECE	2026-03-26 23:42:33.932449	1	8901764012275	t	95
10	Beverages	0	2026-03-26 23:16:42.985726	35	f	\N	10	Coca-Cola Original Taste 2L	\N	\N	PIECE	2026-03-26 23:42:33.993876	1	8901764012275	t	95
26	Personal Care	0	2026-03-26 23:31:28.583629	60	f	\N	10	Dabur Red Paste 200g	\N	\N	PIECE	2026-03-26 23:42:34.082722	1	8901207011683	t	110
29	Grocery	0	2026-03-26 23:31:28.694541	60	f	\N	10	Everest Garam Masala 100g	\N	\N	PIECE	2026-03-26 23:42:34.194744	1	8901786160000	t	72
14	Grocery	0	2026-03-26 23:16:43.170011	60	f	\N	10	Everest Garam Masala 100g	\N	\N	PIECE	2026-03-26 23:42:34.258065	1	8901786160000	t	72
22	Grocery	0	2026-03-26 23:31:28.391487	30	f	\N	10	Fortune Sunlite Refined Sunflower Oil 1L	\N	\N	PIECE	2026-03-26 23:42:34.310924	1	8906007280017	t	145
7	Grocery	0	2026-03-26 23:16:42.785872	30	f	\N	10	Fortune Sunlite Refined Sunflower Oil 1L	\N	\N	PIECE	2026-03-26 23:42:34.420493	1	8906007280017	t	145
8	Snacks	0	2026-03-26 23:16:42.828869	25	f	\N	10	Haldiram's Bhujia Sev 400g	\N	\N	PIECE	2026-03-26 23:42:34.500543	1	8904004400512	t	105
23	Snacks	0	2026-03-26 23:31:28.435619	25	f	\N	10	Haldiram's Bhujia Sev 400g	\N	\N	PIECE	2026-03-26 23:42:34.551984	1	8904004400512	t	105
27	Snacks	0	2026-03-26 23:31:28.626922	80	f	\N	10	Lays India's Magic Masala 52g	\N	\N	PIECE	2026-03-26 23:42:34.625396	1	8901491101901	t	20
12	Snacks	0	2026-03-26 23:16:43.090229	80	f	\N	10	Lays India's Magic Masala 52g	\N	\N	PIECE	2026-03-26 23:42:34.699538	1	8901491101901	t	20
19	Grocery	0	2026-03-26 23:31:28.254184	150	f	\N	10	Maggi 2-Minute Noodles 140g	\N	\N	PIECE	2026-03-26 23:42:34.761491	1	8901058810235	t	28
4	Grocery	0	2026-03-26 23:16:42.606459	150	f	\N	10	Maggi 2-Minute Noodles 140g	\N	\N	PIECE	2026-03-26 23:42:34.821085	1	8901058810235	t	28
1	General	0	2026-03-26 08:26:34.011729	11	f	\N	1.98	Milk	\N	\N	KG	2026-03-26 23:42:34.870932	1	\N	\N	\N
28	Snacks	0	2026-03-26 23:31:28.660669	45	f	\N	10	Parle-G Gold 1kg	\N	\N	PIECE	2026-03-26 23:42:35.015488	1	8901719227184	t	150
6	Household	0	2026-03-26 23:16:42.745338	40	f	\N	10	Surf Excel Easy Wash Detergent 1kg	\N	\N	PIECE	2026-03-26 23:42:35.041243	1	8901030386260	t	130
21	Household	0	2026-03-26 23:31:28.351505	40	f	\N	10	Surf Excel Easy Wash Detergent 1kg	\N	\N	PIECE	2026-03-26 23:42:35.069893	1	8901030386260	t	130
3	Grocery	0	2026-03-26 23:16:42.555161	100	f	\N	10	Tata Salt Vacuum Evaporated 1kg	\N	\N	PIECE	2026-03-26 23:42:35.250794	1	8901207000021	t	24
18	Grocery	0	2026-03-26 23:31:28.176635	100	f	\N	10	Tata Salt Vacuum Evaporated 1kg	\N	\N	PIECE	2026-03-26 23:42:35.312088	1	8901207000021	t	24
31	Household	0	2026-03-26 23:31:28.763614	35	f	\N	10	Vim Dishwash Liquid Lemon 500ml	\N	\N	PIECE	2026-03-26 23:42:35.355338	1	8901030325177	t	115
16	Household	0	2026-03-26 23:16:43.243077	35	f	\N	10	Vim Dishwash Liquid Lemon 500ml	\N	\N	PIECE	2026-03-26 23:42:35.400547	1	8901030325177	t	115
35	Dairy	0	2026-03-26 23:42:44.58013	20	f	\N	10	Amul Butter Pasteurized 500g	\N	\N	PIECE	2026-03-27 11:55:42.219094	1	8901262010011	t	255
39	Snacks	0	2026-03-26 23:42:44.77084	40	f	\N	10	Britannia Good Day Cashew 600g	\N	\N	PIECE	2026-03-27 11:55:42.338565	1	8901063140594	t	120
45	Beverages	0	2026-03-26 23:42:45.049699	20	f	\N	10	Brooke Bond Red Label Tea 500g	\N	\N	PIECE	2026-03-27 11:55:42.382334	1	8901030006267	t	260
40	Beverages	0	2026-03-26 23:42:44.804373	35	f	\N	10	Coca-Cola Original Taste 2L	\N	\N	PIECE	2026-03-27 11:55:42.418785	1	8901764012275	t	95
41	Personal Care	0	2026-03-26 23:42:44.850025	60	f	\N	10	Dabur Red Paste 200g	\N	\N	PIECE	2026-03-27 11:55:42.895278	1	8901207011683	t	110
44	Grocery	0	2026-03-26 23:42:45.00272	60	f	\N	10	Everest Garam Masala 100g	\N	\N	PIECE	2026-03-27 11:55:42.959868	1	8901786160000	t	72
37	Grocery	0	2026-03-26 23:42:44.680743	30	f	\N	10	Fortune Sunlite Refined Sunflower Oil 1L	\N	\N	PIECE	2026-03-27 11:55:42.997834	1	8906007280017	t	145
38	Snacks	0	2026-03-26 23:42:44.729012	25	f	\N	10	Haldiram's Bhujia Sev 400g	\N	\N	PIECE	2026-03-27 11:55:43.047321	1	8904004400512	t	105
42	Snacks	0	2026-03-26 23:42:44.908741	80	f	\N	10	Lays India's Magic Masala 52g	\N	\N	PIECE	2026-03-27 11:55:43.097318	1	8901491101901	t	20
34	Grocery	0	2026-03-26 23:42:44.529306	150	f	\N	10	Maggi 2-Minute Noodles 140g	\N	\N	PIECE	2026-03-27 11:55:43.156413	1	8901058810235	t	28
43	Snacks	0	2026-03-26 23:42:44.967336	45	f	\N	10	Parle-G Gold 1kg	\N	\N	PIECE	2026-03-27 11:55:43.205202	1	8901719227184	t	150
36	Household	0	2026-03-26 23:42:44.626784	40	f	\N	10	Surf Excel Easy Wash Detergent 1kg	\N	\N	PIECE	2026-03-27 11:55:43.239215	1	8901030386260	t	130
33	Grocery	0	2026-03-26 23:42:44.477267	100	f	\N	10	Tata Salt Vacuum Evaporated 1kg	\N	\N	PIECE	2026-03-27 11:55:43.284628	1	8901207000021	t	24
46	Household	0	2026-03-26 23:42:45.094526	35	f	\N	10	Vim Dishwash Liquid Lemon 500ml	\N	\N	PIECE	2026-03-27 11:55:43.339493	1	8901030325177	t	115
32	Grocery	0	2026-03-26 23:42:44.378686	50	f	\N	10	Aashirvaad Shudh Chakki Atta 5kg	\N	\N	PIECE	2026-03-27 11:55:41.939626	1	8901725132274	t	250
47	Grocery	0	2026-03-27 11:56:45.868395	2	f	\N	10	Aashirvaad Shudh Chakki Atta 5kg	\N	\N	PIECE	2026-03-27 11:57:03.289499	1	8901725132274	t	250
50	Dairy	0	2026-03-27 11:56:46.076353	2	f	\N	10	Amul Butter Pasteurized 500g	\N	\N	PIECE	2026-03-27 11:57:03.347486	1	8901262010011	t	255
54	Snacks	0	2026-03-27 11:56:46.218432	2	f	\N	10	Britannia Good Day Cashew 600g	\N	\N	PIECE	2026-03-27 11:57:03.379607	1	8901063140594	t	120
60	Beverages	0	2026-03-27 11:56:46.430499	2	f	\N	10	Brooke Bond Red Label Tea 500g	\N	\N	PIECE	2026-03-27 11:57:03.425732	1	8901030006267	t	260
55	Beverages	0	2026-03-27 11:56:46.25006	2	f	\N	10	Coca-Cola Original Taste 2L	\N	\N	PIECE	2026-03-27 11:57:03.468934	1	8901764012275	t	95
56	Personal Care	0	2026-03-27 11:56:46.283883	2	f	\N	10	Dabur Red Paste 200g	\N	\N	PIECE	2026-03-27 11:57:03.51842	1	8901207011683	t	110
59	Grocery	0	2026-03-27 11:56:46.389752	2	f	\N	10	Everest Garam Masala 100g	\N	\N	PIECE	2026-03-27 11:57:03.570409	1	8901786160000	t	72
52	Grocery	0	2026-03-27 11:56:46.149724	2	f	\N	10	Fortune Sunlite Refined Sunflower Oil 1L	\N	\N	PIECE	2026-03-27 11:57:03.608234	1	8906007280017	t	145
53	Snacks	0	2026-03-27 11:56:46.184176	2	f	\N	10	Haldiram's Bhujia Sev 400g	\N	\N	PIECE	2026-03-27 11:57:03.658804	1	8904004400512	t	105
57	Snacks	0	2026-03-27 11:56:46.318928	2	f	\N	10	Lays India's Magic Masala 52g	\N	\N	PIECE	2026-03-27 11:57:03.708572	1	8901491101901	t	20
49	Grocery	0	2026-03-27 11:56:46.039702	2	f	\N	10	Maggi 2-Minute Noodles 140g	\N	\N	PIECE	2026-03-27 11:57:03.758327	1	8901058810235	t	28
58	Snacks	0	2026-03-27 11:56:46.358507	2	f	\N	10	Parle-G Gold 1kg	\N	\N	PIECE	2026-03-27 11:57:03.797123	1	8901719227184	t	150
51	Household	0	2026-03-27 11:56:46.115901	2	f	\N	10	Surf Excel Easy Wash Detergent 1kg	\N	\N	PIECE	2026-03-27 11:57:03.847134	1	8901030386260	t	130
48	Grocery	0	2026-03-27 11:56:45.968227	2	f	\N	10	Tata Salt Vacuum Evaporated 1kg	\N	\N	PIECE	2026-03-27 11:57:03.889712	1	8901207000021	t	24
61	Household	0	2026-03-27 11:56:46.468226	2	f	\N	10	Vim Dishwash Liquid Lemon 500ml	\N	\N	PIECE	2026-03-27 11:57:03.931404	1	8901030325177	t	115
62	Grocery	0	2026-03-27 11:57:21.789898	2	f	\N	10	Aashirvaad Shudh Chakki Atta 5kg	\N	\N	PIECE	2026-03-27 13:42:41.604711	1	8901725132274	t	250
65	Dairy	0	2026-03-27 11:57:21.983661	2	f	\N	10	Amul Butter Pasteurized 500g	\N	\N	PIECE	2026-03-27 13:42:41.858139	1	8901262010011	t	255
69	Snacks	0	2026-03-27 11:57:22.178173	2	f	\N	10	Britannia Good Day Cashew 600g	\N	\N	PIECE	2026-03-27 13:42:41.912939	1	8901063140594	t	120
75	Beverages	0	2026-03-27 11:57:22.467226	2	f	\N	10	Brooke Bond Red Label Tea 500g	\N	\N	PIECE	2026-03-27 13:42:41.94726	1	8901030006267	t	260
70	Beverages	0	2026-03-27 11:57:22.220298	2	f	\N	10	Coca-Cola Original Taste 2L	\N	\N	PIECE	2026-03-27 13:42:42.004685	1	8901764012275	t	95
71	Personal Care	0	2026-03-27 11:57:22.252904	2	f	\N	10	Dabur Red Paste 200g	\N	\N	PIECE	2026-03-27 13:42:42.058531	1	8901207011683	t	110
74	Grocery	0	2026-03-27 11:57:22.434979	2	f	\N	10	Everest Garam Masala 100g	\N	\N	PIECE	2026-03-27 13:42:42.108051	1	8901786160000	t	72
67	Grocery	0	2026-03-27 11:57:22.054964	2	f	\N	10	Fortune Sunlite Refined Sunflower Oil 1L	\N	\N	PIECE	2026-03-27 13:42:42.183681	1	8906007280017	t	145
68	Snacks	0	2026-03-27 11:57:22.115821	2	f	\N	10	Haldiram's Bhujia Sev 400g	\N	\N	PIECE	2026-03-27 13:42:42.225213	1	8904004400512	t	105
72	Snacks	0	2026-03-27 11:57:22.299871	2	f	\N	10	Lays India's Magic Masala 52g	\N	\N	PIECE	2026-03-27 13:42:42.275122	1	8901491101901	t	20
64	Grocery	0	2026-03-27 11:57:21.919495	2	f	\N	10	Maggi 2-Minute Noodles 140g	\N	\N	PIECE	2026-03-27 13:42:42.343136	1	8901058810235	t	28
73	Snacks	0	2026-03-27 11:57:22.392413	2	f	\N	10	Parle-G Gold 1kg	\N	\N	PIECE	2026-03-27 13:42:42.41294	1	8901719227184	t	150
66	Household	0	2026-03-27 11:57:22.015657	2	f	\N	10	Surf Excel Easy Wash Detergent 1kg	\N	\N	PIECE	2026-03-27 13:42:42.469602	1	8901030386260	t	130
63	Grocery	0	2026-03-27 11:57:21.839931	2	f	\N	10	Tata Salt Vacuum Evaporated 1kg	\N	\N	PIECE	2026-03-27 13:42:42.505838	1	8901207000021	t	24
77	General	0	2026-03-27 12:01:02.534131	0	f	\N	1	Vasantha Kumar			KG	2026-03-27 13:42:42.551243	1	8901180948385	t	1000
76	Household	0	2026-03-27 11:57:22.496865	2	f	\N	10	Vim Dishwash Liquid Lemon 500ml	\N	\N	PIECE	2026-03-27 13:42:42.608409	1	8901030325177	t	115
78	Grocery	0	2026-03-27 13:43:51.496819	2	t	\N	10	Aashirvaad Shudh Chakki Atta 5kg	\N	\N	PIECE	2026-03-27 13:43:51.496819	1	8901725132274	t	250
79	Grocery	0	2026-03-27 13:43:51.618162	2	t	\N	10	Tata Salt Vacuum Evaporated 1kg	\N	\N	PIECE	2026-03-27 13:43:51.618162	1	8901207000021	t	24
80	Grocery	0	2026-03-27 13:43:51.655075	2	t	\N	10	Maggi 2-Minute Noodles 140g	\N	\N	PIECE	2026-03-27 13:43:51.655075	1	8901058810235	t	28
81	Dairy	0	2026-03-27 13:43:51.69754	2	t	\N	10	Amul Butter Pasteurized 500g	\N	\N	PIECE	2026-03-27 13:43:51.69754	1	8901262010011	t	255
82	Household	0	2026-03-27 13:43:51.739427	2	t	\N	10	Surf Excel Easy Wash Detergent 1kg	\N	\N	PIECE	2026-03-27 13:43:51.739427	1	8901030386260	t	130
83	Grocery	0	2026-03-27 13:43:51.799396	2	t	\N	10	Fortune Sunlite Refined Sunflower Oil 1L	\N	\N	PIECE	2026-03-27 13:43:51.799396	1	8906007280017	t	145
84	Snacks	0	2026-03-27 13:43:51.855381	2	t	\N	10	Haldiram's Bhujia Sev 400g	\N	\N	PIECE	2026-03-27 13:43:51.855381	1	8904004400512	t	105
85	Snacks	0	2026-03-27 13:43:51.890029	2	t	\N	10	Britannia Good Day Cashew 600g	\N	\N	PIECE	2026-03-27 13:43:51.890029	1	8901063140594	t	120
86	Beverages	0	2026-03-27 13:43:51.917963	2	t	\N	10	Coca-Cola Original Taste 2L	\N	\N	PIECE	2026-03-27 13:43:51.917963	1	8901764012275	t	95
87	Personal Care	0	2026-03-27 13:43:51.944874	2	t	\N	10	Dabur Red Paste 200g	\N	\N	PIECE	2026-03-27 13:43:51.944874	1	8901207011683	t	110
88	Snacks	0	2026-03-27 13:43:51.965668	2	t	\N	10	Lays India's Magic Masala 52g	\N	\N	PIECE	2026-03-27 13:43:51.965668	1	8901491101901	t	20
89	Snacks	0	2026-03-27 13:43:51.989694	2	t	\N	10	Parle-G Gold 1kg	\N	\N	PIECE	2026-03-27 13:43:51.989694	1	8901719227184	t	150
90	Grocery	0	2026-03-27 13:43:52.033806	2	t	\N	10	Everest Garam Masala 100g	\N	\N	PIECE	2026-03-27 13:43:52.033806	1	8901786160000	t	72
91	Beverages	0	2026-03-27 13:43:52.059863	2	t	\N	10	Brooke Bond Red Label Tea 500g	\N	\N	PIECE	2026-03-27 13:43:52.059863	1	8901030006267	t	260
92	Household	0	2026-03-27 13:43:52.077348	2	t	\N	10	Vim Dishwash Liquid Lemon 500ml	\N	\N	PIECE	2026-03-27 13:43:52.077348	1	8901030325177	t	115
93	General	0	2026-03-27 15:50:55.79433	10	t	\N	1	Apple			KG	2026-03-27 15:50:55.79433	1	123456	t	120
\.


--
-- Data for Name: item_ingredients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.item_ingredients (id, inventory_item_name, quantity_used, unit, inventory_item_id, menu_item_id) FROM stdin;
\.


--
-- Data for Name: menu_item_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_item_tags (menu_item_id, tag) FROM stdin;
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_items (id, category, created_at, description, image_url, is_available, is_veg, name, preparation_time, price, sort_order, tax_rate, updated_at, restaurant_id, is_recommended, order_count, tamil_description, tamil_name) FROM stdin;
104	Starters	2026-04-15 08:44:30.93258	Deep-fried spicy chicken appetizer	\N	t	f	Chicken 65	10	240	0	0	2026-04-17 14:12:46.359506	1	f	3	\N	சிக்கன் 65
102	Biryani	2026-04-15 08:44:30.919001	Signature chicken biryani with aromatic spices	\N	t	f	Chicken Biryani	10	280	0	0	2026-04-15 15:22:35.820037	1	f	2	\N	சிக்கன் பிரியாணி
101	Biryani	2026-04-15 08:44:30.801138	Seeraga samba rice with spiced mutton	\N	t	f	Mutton Biryani	10	350	0	0	2026-04-15 08:44:30.801138	1	f	0	\N	மட்டன் பிரியாணி
105	Main Course	2026-04-15 08:44:30.940796	Dry mutton roast with pepper and spices	\N	t	f	Mutton Sukka	10	320	0	0	2026-04-15 08:44:30.940796	1	f	0	\N	மட்டன் சுக்கா
108	Main Course	2026-04-15 08:44:30.993465	Chopped parotta mixed with chicken and spices	\N	t	f	Kothu Parotta	10	180	0	0	2026-04-15 08:44:30.995254	1	f	0	\N	கொத்து பரோட்டா
110	Soups	2026-04-15 08:44:31.01288	Spicy tangy South Indian soup	\N	t	t	Rasam	10	60	0	0	2026-04-15 08:44:31.01288	1	f	0	\N	ரசம்
111	Side Dish	2026-04-15 08:44:31.023506	Fresh plain yogurt	\N	t	t	Curd	10	50	0	0	2026-04-15 08:44:31.024028	1	f	0	\N	தயிர்
112	Desserts	2026-04-15 08:44:31.029409	Sweet milk-based dessert with vermicelli	\N	t	t	Payasam	10	90	0	0	2026-04-15 08:44:31.029409	1	f	0	\N	பாயாசம்
113	South Indian	2026-04-15 08:44:31.033871	Deep-fried lentil fritters	\N	t	t	Vada	10	50	0	0	2026-04-15 08:44:31.033871	1	f	0	\N	வடை
114	South Indian	2026-04-15 08:44:31.042261	Crispy dosa with spiced potato filling	\N	t	t	Masala Dosa	10	80	0	0	2026-04-15 08:44:31.042261	1	f	0	\N	மசாலா தோசை
115	South Indian	2026-04-15 08:44:31.045153	Thin crispy rice crepe	\N	t	t	Plain Dosa	10	50	0	0	2026-04-15 08:44:31.045153	1	f	0	\N	சாதா தோசை
116	Breakfast	2026-04-15 08:44:31.059435	Steamed fermented rice cakes	\N	t	t	Idli	10	40	0	0	2026-04-15 08:44:31.059435	1	f	0	\N	இட்லி
103	Biryani	2026-04-15 08:44:30.924878	Boiled eggs cooked with biryani masala	\N	t	f	Egg Biryani	10	220	0	0	2026-04-16 14:09:24.873004	1	f	2	\N	முட்டை பிரியாணி
117	South Indian	2026-04-15 08:44:31.063202	Crispy vada soaked in tangy sambar	\N	t	t	Sambar Vada	10	70	0	0	2026-04-15 08:44:31.063202	1	f	0	\N	சாம்பார் வடை
118	South Indian	2026-04-15 08:44:31.069582	Thick rice pancake with toppings	\N	t	t	Uthappam	10	90	0	0	2026-04-15 08:44:31.069582	1	f	0	\N	உத்தப்பம்
119	Breakfast	2026-04-15 08:44:31.073877	Rice and lentil dish seasoned with pepper	\N	t	t	Pongal	10	70	0	0	2026-04-15 08:44:31.073877	1	f	0	\N	பொங்கல்
122	Main Course	2026-04-15 08:44:31.090321	Creamy tomato-based paneer curry	\N	t	t	Paneer Butter Masala	10	280	0	0	2026-04-15 08:44:31.090321	1	f	0	\N	பனீர் பட்டர் மசாலா
124	Starters	2026-04-15 08:44:31.092259	Indo-Chinese crispy cauliflower in sauce	\N	t	t	Gobi Manchurian	10	160	0	0	2026-04-15 08:44:31.092259	1	f	0	\N	கோபி மஞ்சூரியன்
106	Main Course	2026-04-15 08:44:30.953375	Traditional South Indian chicken gravy	\N	t	f	Chicken Curry	10	260	0	0	2026-05-02 08:02:33.821467	1	f	3	\N	சிக்கன் குழம்பு
120	Breads	2026-04-15 08:44:31.079154	Whole wheat flatbread	\N	t	t	Chapati	10	20	0	0	2026-05-02 08:03:32.534652	1	f	22	\N	சப்பாத்தி
123	Main Course	2026-04-15 08:44:31.092259	Yellow lentils tempered with cumin and spices	\N	t	t	Dal Tadka	10	150	0	0	2026-05-02 08:18:55.726908	1	f	6	\N	தால் தட்கா
121	Breads	2026-04-15 08:44:31.08436	Leavened oven-baked flatbread	\N	t	t	Naan	10	40	0	0	2026-05-02 08:26:19.217766	1	f	18	\N	நான்
107	Breads	2026-04-15 08:44:30.980087	Layered flaky flatbread	\N	t	t	Parotta	10	30	0	0	2026-05-02 08:26:19.219297	1	f	5	\N	பரோட்டா
109	Starters	2026-04-15 08:44:31.006362	Marinated fish shallow fried	\N	t	f	Fish Fry	10	280	0	0	2026-05-02 08:26:19.220701	1	f	1	\N	மீன் வறுவல்
88	South Indian	2026-03-19 23:33:35.897828	Crispy dosa filled with spiced potato masala	\N	t	t	Masala Dosa	10	120	0	0	2026-03-19 23:33:35.897828	5	f	0	\N	\N
89	South Indian	2026-03-19 23:33:35.903323	Crispy dosa roasted with ghee	\N	t	t	Ghee Roast	10	140	0	0	2026-03-19 23:33:35.903323	5	f	0	\N	\N
90	Desserts	2026-03-19 23:33:35.908128	Sweet semolina dessert with ghee and nuts	\N	t	t	Rava Kesari	10	80	0	0	2026-03-19 23:33:35.908128	5	f	0	\N	\N
91	Beverages	2026-03-19 23:33:35.91394	Traditional South Indian filter coffee	\N	t	t	Filter Coffee	10	50	0	0	2026-03-19 23:33:35.91394	5	f	0	\N	\N
92	Meals	2026-03-19 23:33:35.917003	Combo of idli, dosa, vada with chutney and sambar	\N	t	t	Mini Tiffin	10	180	0	0	2026-03-19 23:33:35.917003	5	f	0	\N	\N
94	Rice	2026-03-19 23:33:35.938134	Rice cooked with lentils and vegetables	\N	t	t	Sambar Rice	10	100	0	0	2026-03-19 23:33:35.938134	5	f	0	\N	\N
95	Main Course	2026-03-19 23:33:35.943449	Aromatic rice cooked with mixed vegetables	\N	t	t	Vegetable Biryani	10	160	0	0	2026-03-19 23:33:35.943449	5	f	0	\N	\N
96	Main Course	2026-03-19 23:33:35.947764	Paneer cubes in rich buttery tomato gravy	\N	t	t	Paneer Butter Masala	10	220	0	0	2026-03-19 23:33:35.947764	5	f	0	\N	\N
98	South Indian	2026-03-19 23:33:35.958445	Deep-fried lentil fritters	\N	t	t	Vada	10	50	0	0	2026-03-19 23:33:35.958445	5	f	0	\N	\N
97	Breads	2026-03-19 23:33:35.953257	Soft whole wheat flatbread	\N	t	t	Chapathi	10	40	0	0	2026-03-19 23:57:11.878211	5	f	1	\N	\N
87	South Indian	2026-03-19 23:33:35.812916	Steamed rice cakes served with chutney and sambar	\N	t	t	Idli	10	40	0	0	2026-03-19 23:57:11.886418	5	f	1	\N	\N
93	Rice	2026-03-19 23:33:35.931782	Rice mixed with curd and tempered spices	\N	t	t	Curd Rice	10	90	0	0	2026-03-19 23:57:32.93189	5	f	1	\N	\N
125	Main Course	2026-04-15 08:44:31.100275	Spiced mushroom gravy	\N	t	t	Mushroom Curry	10	200	0	0	2026-04-15 08:44:31.100275	1	f	0	\N	காளான் குழம்பு
126	Main Course	2026-04-15 08:44:31.102911	Spicy prawn curry	\N	t	f	Prawn Masala	10	380	0	0	2026-04-15 08:44:31.102911	1	f	0	\N	இறால் மசாலா
128	Beverages	2026-04-15 08:44:31.112914	Traditional South Indian filter coffee	\N	t	t	Filter Coffee	10	40	0	0	2026-04-15 08:44:31.112914	1	f	0	\N	ஃபில்டர் காபி
129	Beverages	2026-04-15 08:44:31.115898	Chilled yogurt-based drink	\N	t	t	Lassi	10	60	0	0	2026-04-15 08:44:31.115898	1	f	0	\N	லஸ்ஸி
130	Beverages	2026-04-15 08:44:31.120292	Fresh tender coconut water	\N	t	t	Tender Coconut	10	60	0	0	2026-04-15 08:44:31.120292	1	f	0	\N	இளநீர்
131	Beverages	2026-04-15 08:44:31.124398	Fresh squeezed lime with sugar or salt	\N	t	t	Lime Juice	10	40	0	0	2026-04-15 08:44:31.124398	1	f	0	\N	எலுமிச்சை ஜூஸ்
132	Starters	2026-04-15 08:44:31.130296	Crispy pastry stuffed with spiced potatoes	\N	t	t	Samosa	10	30	0	0	2026-04-15 08:44:31.130296	1	f	0	\N	சமோசா
133	Starters	2026-04-15 08:44:31.136393	Crispy onion fritters	\N	t	t	Onion Pakoda	10	80	0	0	2026-04-15 08:44:31.136393	1	f	0	\N	வெங்காய பஜ்ஜி
135	Soups	2026-04-15 08:44:31.161679	Creamy tangy tomato soup	\N	t	t	Tomato Soup	10	80	0	0	2026-04-15 08:44:31.161679	1	f	0	\N	தக்காளி சூப்
136	Desserts	2026-04-15 08:44:31.172394	Chilled dairy frozen dessert	\N	t	t	Ice Cream	10	80	0	0	2026-04-15 08:44:31.172394	1	f	0	\N	ஐஸ் கிரீம்
137	Desserts	2026-04-15 08:44:31.189094	Soft milk-solid balls soaked in sugar syrup	\N	t	t	Gulab Jamun	10	60	0	0	2026-04-15 08:44:31.189628	1	f	0	\N	குலாப் ஜாமுன்
138	Desserts	2026-04-15 08:44:31.199176	Sweet dense confection made with semolina	\N	t	t	Halwa	10	80	0	0	2026-04-15 08:44:31.199176	1	f	0	\N	அல்வா
134	Soups	2026-04-15 08:44:31.14693	Clear chicken broth with vegetables	\N	t	f	Chicken Soup	10	120	0	0	2026-04-21 08:16:33.484333	1	f	2	\N	சிக்கன் சூப்
127	Main Course	2026-04-15 08:44:31.108127	Boiled eggs in spicy gravy	\N	t	f	Egg Curry	10	180	0	0	2026-05-02 08:02:33.821467	1	f	1	\N	முட்டை குழம்பு
139	Main Course	2026-04-15 08:44:31.209058	Spiced chickpeas with fried fluffy bread	\N	t	t	Chole Bhature	10	160	0	0	2026-05-02 08:18:55.731071	1	f	2	\N	சோலே பட்டூரே
140	Rice & Biryani	2026-04-15 08:44:31.216718	Stir-fried rice with mixed vegetables	\N	t	t	Veg Fried Rice	10	150	0	0	2026-04-15 08:44:31.216718	1	f	0	\N	வெஜ் ஃப்ரைட் ரைஸ்
141	Rice & Biryani	2026-04-15 08:44:31.225503	Stir-fried rice with chicken and vegetables	\N	t	f	Chicken Fried Rice	10	200	0	0	2026-04-15 08:50:23.64203	1	f	1	\N	சிக்கன் ஃப்ரைட் ரைஸ்
\.


--
-- Data for Name: order_extra_charges; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_extra_charges (order_id, charge_amount, charge_name) FROM stdin;
109	10	Parcel Charge
141	15	Parcel
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, added_by_name, category, name, notes, price, quantity, status, tax_rate, added_by, menu_item_id, order_id, completed_quantity, barcode, inventory_item_id) FROM stdin;
194	Madhavan	\N	Chapati		24	1	READY	0	1	120	97	1	\N	\N
195	Madhavan	\N	Chicken Soup		144	1	READY	0	1	134	97	1	\N	\N
196	Madhavan	\N	Chicken Fried Rice		240	1	READY	0	1	141	97	1	\N	\N
197	Madhavan	\N	Chicken 65		288	1	READY	0	1	104	97	1	\N	\N
213	Customer	\N	Dal Tadka		150	2	READY	0	\N	123	103	2	\N	\N
214	Customer	\N	Egg Biryani		220	1	READY	0	\N	103	103	1	\N	\N
230	Madhavan	\N	Chapati		20	1	PENDING	0	1	120	110	0	\N	\N
231	Madhavan	\N	Egg Biryani		220	1	PENDING	0	1	103	110	0	\N	\N
239	Madhavan	\N	Chapati		23.6	1	PENDING	0	1	120	116	0	\N	\N
240	Madhavan	\N	Naan		47.2	1	PENDING	0	1	121	116	0	\N	\N
256	Madhavan	\N	Naan		48	1	PENDING	0	1	121	122	0	\N	\N
257	Madhavan	\N	Chapati		24	1	PENDING	0	1	120	122	0	\N	\N
261	Madhavan	\N	Naan		48	1	PENDING	0	1	121	127	0	\N	\N
260	Madhavan	\N	Chapati		24	1	READY	0	1	120	127	1	\N	\N
270	Madhavan	\N	Chapati		24	1	PENDING	0	1	120	133	0	\N	\N
1	Madhavan	\N	Chicken Biriyani 		150	1	READY	0	1	\N	1	\N	\N	\N
2	Madhavan	\N	Chicken 65		200	1	READY	0	1	\N	1	\N	\N	\N
3	Madhavan	\N	Chicken 65		200	1	READY	0	1	\N	1	\N	\N	\N
4	Madhavan	\N	Chicken 65		200	1	READY	0	1	\N	2	\N	\N	\N
5	Madhavan	\N	Chicken Biriyani 		150	1	READY	0	1	\N	2	\N	\N	\N
6	Madhavan	\N	Chicken Biriyani 		150	1	PREPARING	0	1	\N	3	\N	\N	\N
7	Madhavan	\N	Chicken 65		200	2	PREPARING	0	1	\N	3	\N	\N	\N
9	Waiter 	Starters	Chicken 65		200	1	READY	5	2	\N	4	\N	\N	\N
8	Waiter 	Mains	Chicken Biriyani 		150	2	READY	5	2	\N	4	\N	\N	\N
10	Waiter 	Mains	Chicken Biriyani 		150	1	READY	5	2	\N	5	\N	\N	\N
12	Waiter 	\N	Chicken 65		200	1	READY	0	2	\N	6	\N	\N	\N
14	Waiter 	Starters	Chicken 65		200	1	READY	5	2	\N	7	\N	\N	\N
15	Madhavan	\N	Chicken 65		200	1	READY	0	1	\N	8	\N	\N	\N
16	Waiter 	Mains	Chicken Biriyani 		150	2	READY	5	2	\N	9	\N	\N	\N
17	Waiter 	Starters	Chicken 65		200	1	READY	5	2	\N	9	\N	\N	\N
18	Madhavan	\N	Chicken 65		200	1	READY	0	1	\N	10	\N	\N	\N
19	Madhavan	\N	Chicken Biriyani 		150	1	READY	0	1	\N	10	\N	\N	\N
20	Madhavan	\N	Chicken Biriyani 		150	1	READY	0	1	\N	11	1	\N	\N
21	Madhavan	\N	Chicken 65		200	1	READY	0	1	\N	11	1	\N	\N
22	Madhavan	\N	Chicken Biriyani 		150	1	READY	0	1	\N	11	1	\N	\N
23	Madhavan	\N	Chicken 65		200	1	READY	0	1	\N	12	1	\N	\N
198	Madhavan	\N	Chapati		20	1	PENDING	0	1	120	98	0	\N	\N
199	Madhavan	\N	Chicken Biryani		280	1	PENDING	0	1	102	98	0	\N	\N
200	Madhavan	\N	Chicken 65		240	1	PENDING	0	1	104	98	0	\N	\N
201	Madhavan	\N	Chicken Curry		260	1	PENDING	0	1	106	98	0	\N	\N
215	Customer	\N	Naan		40	2	READY	0	\N	121	104	2	\N	\N
216	Customer	\N	Chicken Curry		260	1	READY	0	\N	106	104	1	\N	\N
217	Customer	\N	Naan		40	2	READY	0	\N	121	105	2	\N	\N
218	Customer	\N	Dal Tadka		150	1	READY	0	\N	123	105	1	\N	\N
219	Customer	\N	Chole Bhature		160	1	READY	0	\N	139	105	1	\N	\N
221	Customer	\N	Parotta		30	1	SERVED	0	\N	107	106	1	\N	\N
222	Customer	\N	Dal Tadka		150	1	SERVED	0	\N	123	106	1	\N	\N
223	Customer	\N	Chicken Biryani		280	1	SERVED	0	\N	102	106	1	\N	\N
232	Staff	\N	Chapati		24	1	PREPARING	0	\N	120	107	0	\N	\N
233	Staff	\N	Naan		48	1	PREPARING	0	\N	121	107	0	\N	\N
241	Madhavan	\N	Chicken 65		283.2	1	PENDING	0	1	104	117	0	\N	\N
242	Madhavan	\N	Chapati		23.6	1	PENDING	0	1	120	117	0	\N	\N
258	Madhavan	\N	Chapati		24	1	PENDING	0	1	120	126	0	\N	\N
259	Madhavan	\N	Naan		48	1	PENDING	0	1	121	126	0	\N	\N
45	Saravana	\N	Chapathi		40	1	PENDING	0	5	97	37	0	\N	\N
46	Saravana	\N	Idli		40	1	PENDING	0	5	87	37	0	\N	\N
47	Customer	\N	Curd Rice		90	1	READY	0	\N	93	38	1	\N	\N
264	Staff	\N	Chicken Fried Rice		240	1	PREPARING	0	\N	141	128	0	\N	\N
263	Staff	\N	Chicken Curry		312	2	PREPARING	0	\N	106	128	1	\N	\N
262	Staff	\N	Chicken Biryani		336	1	READY	0	\N	102	128	1	\N	\N
271	Waiter 	Breads	Chapati		20	1	PENDING	0	2	120	135	0	\N	\N
272	Waiter 	Breads	Naan		40	1	PENDING	0	2	121	135	0	\N	\N
277	Waiter 	Breads	Naan		40	1	PENDING	0	2	121	138	0	\N	\N
278	Waiter 	Breads	Chapati		20	1	PENDING	0	2	120	138	0	\N	\N
25	Madhavan	\N	Chicken Biryani		280	1	READY	0	1	\N	14	1	\N	\N
202	Waiter 	Breads	Chapati		20	1	PENDING	0	2	120	99	0	\N	\N
203	Waiter 	Breads	Naan		40	1	PENDING	0	2	121	99	0	\N	\N
220	Customer	\N	Chapati		20	1	READY	0	\N	120	105	1	\N	\N
224	Staff	\N	Chicken Curry		260	1	SERVED	0	\N	106	106	1	\N	\N
226	Staff	\N	Chapati		20	2	SERVED	0	\N	120	106	2	\N	\N
234	Madhavan	\N	Chicken Soup		141.6	1	PREPARING	0	1	134	109	0	\N	\N
243	Madhavan	\N	Dal Tadka		177	1	PENDING	0	1	123	118	0	\N	\N
244	Madhavan	\N	Naan		47.2	1	PENDING	0	1	121	118	0	\N	\N
265	Madhavan	\N	Chapati		24	1	PENDING	0	1	120	130	0	\N	\N
266	Madhavan	\N	Naan		48	1	PENDING	0	1	121	130	0	\N	\N
273	Waiter 	Main Course	Chicken Curry		260	1	PENDING	0	2	106	136	0	\N	\N
274	Waiter 	Main Course	Egg Curry		180	1	PENDING	0	2	127	136	0	\N	\N
82	Customer	\N	Fish Fry		280	1	READY	0	\N	\N	50	1	\N	\N
204	Waiter 	Breads	Chapati		20	1	PENDING	0	2	120	100	0	\N	\N
205	Waiter 	Breads	Naan		40	1	PENDING	0	2	121	100	0	\N	\N
206	Waiter 	Breads	Parotta		30	1	PENDING	0	2	107	100	0	\N	\N
225	Staff	\N	Naan		40	1	SERVED	0	\N	121	106	1	\N	\N
235	Madhavan	\N	Chapati		23.6	1	PENDING	0	1	120	111	0	\N	\N
236	Madhavan	\N	Naan		47.2	1	PENDING	0	1	121	111	0	\N	\N
249	Staff	\N	Chapati		24	1	PREPARING	0	\N	120	119	0	\N	\N
250	Staff	\N	Naan		48	1	PREPARING	0	\N	121	119	0	\N	\N
267	Madhavan	\N	Chapati		24	1	PENDING	0	1	120	131	0	\N	\N
268	Madhavan	\N	Naan		48	1	PENDING	0	1	121	131	0	\N	\N
275	Waiter 	Breads	Naan		40	1	PENDING	0	2	121	137	0	\N	\N
276	Waiter 	Breads	Chapati		20	1	PENDING	0	2	120	137	0	\N	\N
179	Madhavan	\N	Britannia Good Day Cashew 600g		120	1	PENDING	0	1	\N	89	0	8901063140594	\N
180	Madhavan	\N	Dabur Red Paste 200g		110	1	PENDING	0	1	\N	89	0	8901207011683	\N
181	Madhavan	\N	Fortune Sunlite Refined Sunflower Oil 1L		145	5	PENDING	0	1	\N	89	0	8906007280017	\N
182	Madhavan	\N	Aashirvaad Shudh Chakki Atta 5kg		250	4	PENDING	0	1	\N	90	0	8901725132274	\N
183	Madhavan	\N	Aashirvaad Shudh Chakki Atta 5kg		250	4	PENDING	0	1	\N	91	0	8901725132274	\N
184	Madhavan	\N	Britannia Good Day Cashew 600g		120	2	PENDING	0	1	\N	92	0	8901063140594	\N
185	Madhavan	\N	Brooke Bond Red Label Tea 500g		260	5	PENDING	0	1	\N	93	0	8901030006267	\N
186	Madhavan	\N	Everest Garam Masala 100g		72	1	PENDING	0	1	\N	93	0	8901786160000	\N
187	Madhavan	\N	Brooke Bond Red Label Tea 500g		260	1	PENDING	0	1	\N	94	0	8901030006267	\N
188	Madhavan	\N	Everest Garam Masala 100g		72	1	PENDING	0	1	\N	94	0	8901786160000	\N
189	Madhavan	\N	Britannia Good Day Cashew 600g		120	1	PENDING	0	1	\N	95	0	8901063140594	\N
26	Madhavan	\N	Chicken Curry		260	1	READY	0	1	\N	14	1	\N	\N
27	Madhavan	\N	Fish Fry		280	1	PREPARING	0	1	\N	15	0	\N	\N
28	Madhavan	\N	Fish Fry		280	1	READY	0	1	\N	16	1	\N	\N
29	Madhavan	\N	Fish Fry		280	1	READY	0	1	\N	17	1	\N	\N
30	Madhavan	\N	Curd		50	1	READY	0	1	\N	18	1	\N	\N
31	Madhavan	\N	Parotta		30	1	READY	0	1	\N	19	1	\N	\N
32	Madhavan	\N	Mutton Sukka		320	1	READY	0	1	\N	19	1	\N	\N
33	Madhavan	\N	Parotta		30	1	READY	0	1	\N	20	1	\N	\N
34	Madhavan	\N	Egg Biryani		220	1	READY	0	1	\N	20	1	\N	\N
35	Madhavan	\N	Chicken Biryani		280	1	READY	0	1	\N	21	1	\N	\N
36	Customer	\N	Egg Biryani		220	1	READY	0	\N	\N	22	1	\N	\N
37	Customer	\N	Fish Fry		280	1	READY	0	\N	\N	23	1	\N	\N
38	Customer	\N	Chicken Biryani		280	1	READY	0	\N	\N	23	1	\N	\N
54	Madhavan	\N	Curd		50	1	PENDING	0	1	\N	43	0	\N	\N
39	Customer	\N	Parotta		30	2	READY	0	\N	\N	24	2	\N	\N
40	Customer	\N	Chicken Biryani		280	1	PREPARING	0	\N	\N	25	0	\N	\N
41	Customer	\N	Fish Fry		280	1	PREPARING	0	\N	\N	26	0	\N	\N
44	Customer	\N	Fish Fry		280	1	READY	0	\N	\N	28	1	\N	\N
55	Madhavan	\N	Egg Biryani		220	1	PENDING	0	1	\N	43	0	\N	\N
43	Customer	\N	Chicken Curry		260	1	READY	0	\N	\N	27	1	\N	\N
42	Customer	\N	Parotta		30	2	READY	0	\N	\N	27	2	\N	\N
49	Waiter 	\N	Chicken 65		240	1	PREPARING	0	2	\N	39	0	\N	\N
50	Madhavan	\N	Chicken Biryani		280	1	READY	0	1	\N	40	1	\N	\N
51	Madhavan	\N	Parotta		30	1	READY	0	1	\N	40	1	\N	\N
52	Madhavan	\N	Fish Fry		280	1	PENDING	0	1	\N	41	0	\N	\N
53	Madhavan	\N	Chicken Curry		260	1	READY	0	1	\N	42	1	\N	\N
56	Madhavan	\N	Chicken Biryani		280	1	READY	0	1	\N	44	1	\N	\N
57	Madhavan	\N	Chicken 65		240	2	PENDING	0	1	\N	45	0	\N	\N
58	Madhavan	\N	Chicken Curry		260	1	READY	0	1	\N	46	1	\N	\N
59	Madhavan	\N	Kothu Parotta		180	1	READY	0	1	\N	46	1	\N	\N
60	Madhavan	\N	Rasam		60	1	READY	0	1	\N	46	1	\N	\N
61	Madhavan	\N	Payasam		90	1	READY	0	1	\N	46	1	\N	\N
62	Madhavan	\N	Chicken 65		240	1	READY	0	1	\N	46	1	\N	\N
67	Madhavan	\N	Payasam		90	1	READY	0	1	\N	47	1	\N	\N
63	Madhavan	\N	Egg Biryani		220	2	READY	0	1	\N	46	2	\N	\N
68	Madhavan	\N	Parotta		30	1	READY	0	1	\N	47	1	\N	\N
69	Madhavan	\N	Chicken Curry		260	1	READY	0	1	\N	47	1	\N	\N
70	Madhavan	\N	Kothu Parotta		180	1	READY	0	1	\N	47	1	\N	\N
64	Madhavan	\N	Chicken 65		240	5	READY	0	1	\N	47	5	\N	\N
65	Madhavan	\N	Curd		50	1	READY	0	1	\N	47	1	\N	\N
66	Madhavan	\N	Rasam		60	1	READY	0	1	\N	47	1	\N	\N
72	Madhavan	\N	Egg Biryani		220	1	READY	0	1	\N	48	1	\N	\N
71	Madhavan	\N	Curd		50	2	READY	0	1	\N	48	2	\N	\N
73	Madhavan	\N	Kothu Parotta		180	1	READY	0	1	\N	48	1	\N	\N
74	Madhavan	\N	Chicken Curry		260	1	READY	0	1	\N	48	1	\N	\N
75	Madhavan	\N	Parotta		30	1	READY	0	1	\N	48	1	\N	\N
76	Madhavan	\N	Fish Fry		280	1	READY	0	1	\N	49	1	\N	\N
77	Madhavan	\N	Egg Biryani		220	1	READY	0	1	\N	49	1	\N	\N
78	Madhavan	\N	Parotta		30	1	READY	0	1	\N	49	1	\N	\N
79	Madhavan	\N	Curd		50	1	READY	0	1	\N	49	1	\N	\N
80	Madhavan	\N	Rasam		60	1	READY	0	1	\N	49	1	\N	\N
81	Madhavan	\N	Payasam		90	1	READY	0	1	\N	49	1	\N	\N
83	Customer	\N	Chicken Biryani		280	1	READY	0	\N	\N	50	1	\N	\N
84	Customer	\N	Parotta		30	1	READY	0	\N	\N	50	1	\N	\N
85	Madhavan	\N	Parotta		30	1	READY	0	1	\N	51	1	\N	\N
86	Madhavan	\N	Egg Biryani		220	1	READY	0	1	\N	51	1	\N	\N
87	Madhavan	\N	Chicken 65		240	1	READY	0	1	\N	51	1	\N	\N
88	Madhavan	\N	Mutton Biryani		350	1	READY	0	1	\N	51	1	\N	\N
89	Madhavan	\N	Rasam		60	1	READY	0	1	\N	51	1	\N	\N
90	Madhavan	\N	Payasam		90	1	READY	0	1	\N	51	1	\N	\N
108	Madhavan	\N	Parotta		30	1	READY	0	1	\N	56	1	\N	\N
91	Madhavan	\N	Chicken Biryani		280	2	READY	0	1	\N	52	2	\N	\N
92	Madhavan	\N	Chicken 65		240	1	READY	0	1	\N	52	1	\N	\N
93	Madhavan	\N	Curd		50	1	READY	0	1	\N	52	1	\N	\N
94	Madhavan	\N	Kothu Parotta		180	1	READY	0	1	\N	52	1	\N	\N
95	Madhavan	\N	Mutton Biryani		350	1	READY	0	1	\N	52	1	\N	\N
96	Madhavan	\N	Curd		50	1	READY	0	1	\N	53	1	\N	\N
97	Madhavan	\N	Egg Biryani		220	1	READY	0	1	\N	53	1	\N	\N
98	Madhavan	\N	Chicken 65		240	1	READY	0	1	\N	53	1	\N	\N
99	Madhavan	\N	Kothu Parotta		180	1	READY	0	1	\N	53	1	\N	\N
100	Madhavan	\N	Fish Fry		280	1	READY	0	1	\N	54	1	\N	\N
101	Madhavan	\N	Egg Biryani		220	1	READY	0	1	\N	54	1	\N	\N
102	Madhavan	\N	Chicken 65		240	1	READY	0	1	\N	54	1	\N	\N
103	Madhavan	\N	Curd		50	1	READY	0	1	\N	55	1	\N	\N
104	Madhavan	\N	Chicken Curry		260	1	READY	0	1	\N	55	1	\N	\N
105	Madhavan	\N	Kothu Parotta		180	1	READY	0	1	\N	55	1	\N	\N
106	Madhavan	\N	Mutton Sukka		320	1	READY	0	1	\N	55	1	\N	\N
107	Madhavan	\N	Mutton Biryani		350	1	READY	0	1	\N	55	1	\N	\N
109	Madhavan	\N	Chicken Biryani		280	1	READY	0	1	\N	56	1	\N	\N
110	Madhavan	\N	Curd		50	1	READY	0	1	\N	56	1	\N	\N
111	Madhavan	\N	Kothu Parotta		180	1	READY	0	1	\N	56	1	\N	\N
112	Madhavan	\N	Chicken Curry		260	1	READY	0	1	\N	56	1	\N	\N
113	Waiter 	Main Course	Kothu Parotta		180	1	READY	0	2	\N	57	1	\N	\N
115	Waiter 	Main Course	Mutton Sukka		320	1	READY	0	2	\N	57	1	\N	\N
114	Waiter 	Main Course	Chicken Curry		260	1	READY	0	2	\N	57	1	\N	\N
118	Waiter 	\N	Egg Biryani		220	4	READY	0	2	\N	57	1	\N	\N
119	Waiter 	\N	Mutton Biryani		350	1	READY	0	2	\N	57	1	\N	\N
120	Waiter 	\N	Chicken Biryani		280	1	READY	0	2	\N	57	1	\N	\N
116	Waiter 	Starters	Chicken 65		240	1	READY	0	2	\N	58	1	\N	\N
117	Waiter 	Breads	Parotta		30	1	READY	0	2	\N	58	1	\N	\N
121	Madhavan	\N	Fish Fry		280	1	PENDING	0	1	\N	59	0	\N	\N
122	Madhavan	\N	Chicken 65		240	1	PENDING	0	1	\N	59	0	\N	\N
123	Madhavan	\N	Egg Biryani		220	1	PENDING	0	1	\N	59	0	\N	\N
124	Waiter 	Starters	Chicken 65		240	1	READY	0	2	\N	60	1	\N	\N
125	Waiter 	Starters	Fish Fry		300	1	READY	0	2	\N	60	1	\N	\N
128	Madhavan	\N	Curd		50	1	READY	0	1	\N	62	1	\N	\N
126	Waiter 	Breads	Parotta		30	2	READY	0	2	\N	61	2	\N	\N
127	Waiter 	Breads	parcel		5	1	READY	0	2	\N	61	1	\N	\N
130	Madhavan	\N	Chicken Biryani		280	1	READY	0	1	\N	62	1	\N	\N
133	Madhavan	\N	Parotta		30	1	READY	0	1	\N	64	1	\N	\N
129	Madhavan	\N	Kothu Parotta		180	1	READY	0	1	\N	63	1	\N	\N
131	Madhavan	\N	Egg Biryani		220	1	READY	0	1	\N	63	1	\N	\N
135	Madhavan	\N	Curd		50	1	READY	0	1	\N	64	1	\N	\N
136	Madhavan	\N	Payasam		90	1	READY	0	1	\N	64	1	\N	\N
132	Madhavan	\N	Fish Fry		300	1	READY	0	1	\N	65	1	\N	\N
134	Madhavan	\N	Egg Biryani		220	1	READY	0	1	\N	65	1	\N	\N
137	Madhavan	\N	Rasam		60	1	READY	0	1	\N	65	1	\N	\N
139	Waiter 	Biryani	Chicken Biryani		280	1	READY	0	2	\N	66	1	\N	\N
140	Waiter 	Main Course	Chicken Curry		260	1	READY	0	2	\N	66	1	\N	\N
141	Waiter 	Main Course	Kothu Parotta		180	1	READY	0	2	\N	66	1	\N	\N
173	Madhavan	\N	Egg Biryani		220	1	READY	0	1	\N	80	1	\N	\N
175	Madhavan	\N	Parotta		30	2	PREPARING	0	1	\N	80	1	\N	\N
138	Waiter 	Biryani	Egg Biryani		220	1	READY	0	2	\N	66	1	\N	\N
176	Madhavan	\N	Chicken 65		240	2	PREPARING	0	1	\N	80	0	\N	\N
144	Madhavan	\N	Parotta		36	1	PENDING	0	1	\N	69	0	\N	\N
146	Madhavan	\N	Curd		60	1	PENDING	0	1	\N	69	0	\N	\N
143	Madhavan	\N	Fish Fry		360	1	PENDING	0	1	\N	70	0	\N	\N
145	Madhavan	\N	Chicken 65		288	1	PENDING	0	1	\N	70	0	\N	\N
147	Madhavan	\N	Egg Biryani		264	1	PREPARING	0	1	\N	69	0	\N	\N
148	Madhavan	\N	Chicken Biryani		280	1	PREPARING	0	1	\N	70	0	\N	\N
142	Madhavan	\N	Fish Fry		360	1	READY	0	1	\N	68	1	\N	\N
150	Madhavan	\N	Parotta		36	1	READY	0	1	\N	71	1	\N	\N
149	Madhavan	\N	Fish Fry		360	1	READY	0	1	\N	72	1	\N	\N
153	Madhavan	\N	Fish Fry		300	1	PREPARING	0	1	\N	73	0	\N	\N
154	Madhavan	\N	Chicken 65		240	1	PREPARING	0	1	\N	73	0	\N	\N
155	Madhavan	\N	Payasam		90	1	PREPARING	0	1	\N	73	0	\N	\N
157	Madhavan	\N	Chicken Biryani		336	1	PENDING	0	1	\N	74	0	\N	\N
156	Madhavan	\N	Fish Fry		360	1	PENDING	0	1	\N	75	0	\N	\N
158	Madhavan	\N	Chicken Curry		312	1	PENDING	0	1	\N	75	0	\N	\N
159	Waiter 	Starters	Fish Fry		300	1	PENDING	0	2	\N	76	0	\N	\N
160	Waiter 	Starters	Chicken 65		240	1	PENDING	0	2	\N	76	0	\N	\N
161	Madhavan	\N	Fish Fry		360	1	READY	0	1	\N	77	0	\N	\N
162	Madhavan	\N	Parotta		36	1	READY	0	1	\N	77	0	\N	\N
163	Madhavan	\N	Chicken 65		240	1	READY	0	1	\N	78	0	\N	\N
165	Madhavan	\N	Chicken 65		288	2	PENDING	0	1	\N	79	0	\N	\N
164	Madhavan	\N	Parotta		36	1	PENDING	0	1	\N	79	0	\N	\N
166	Madhavan	\N	Fish Fry		300	1	PENDING	0	1	\N	80	0	\N	\N
167	Madhavan	\N	Parotta		30	1	PENDING	0	1	\N	80	0	\N	\N
169	Madhavan	\N	Curd		50	1	PENDING	0	1	\N	81	0	\N	\N
170	Madhavan	\N	Egg Biryani		220	1	PENDING	0	1	\N	81	0	\N	\N
171	Madhavan	\N	Chicken Curry		260	1	PENDING	0	1	\N	81	0	\N	\N
172	Madhavan	\N	Fish Fry		300	1	PENDING	0	1	\N	80	0	\N	\N
190	Customer	\N	Parotta		30	1	READY	0	\N	\N	96	1	\N	\N
174	Madhavan	\N	Mutton Biryani		350	1	PENDING	0	1	\N	80	0	\N	\N
168	Madhavan	\N	Chicken 65		240	1	READY	0	1	\N	80	1	\N	\N
177	Bala	\N	Fish Fry		360	1	READY	0	14	\N	83	1	\N	\N
178	Bala	\N	Chicken Biryani		336	1	PREPARING	0	14	\N	83	0	\N	\N
191	Customer	\N	Chicken 65		240	1	READY	0	\N	\N	96	1	\N	\N
192	Customer	\N	Egg Biryani		220	1	READY	0	\N	\N	96	1	\N	\N
193	Customer	\N	Curd		50	1	READY	0	\N	\N	96	1	\N	\N
207	Waiter 	Breads	Chapati		20	1	READY	0	2	120	101	1	\N	\N
208	Waiter 	Breads	Parotta		30	1	READY	0	2	107	101	1	\N	\N
209	Waiter 	\N	Chicken Fried Rice		200	1	READY	0	2	141	101	1	\N	\N
210	Waiter 	\N	Veg Fried Rice		150	1	READY	0	2	140	101	1	\N	\N
211	Waiter 	Breads	Naan		40	1	PENDING	0	2	121	102	0	\N	\N
212	Waiter 	Breads	Chapati		20	1	PENDING	0	2	120	102	0	\N	\N
229	Madhavan	\N	Chicken Soup		144	1	READY	0	1	134	109	1	\N	\N
227	Madhavan	\N	Dal Tadka		180	1	READY	0	1	123	109	2	\N	\N
228	Madhavan	\N	Parotta		36	1	READY	0	1	107	109	2	\N	\N
237	Madhavan	\N	Chapati		23.6	1	PENDING	0	1	120	112	0	\N	\N
238	Madhavan	\N	Naan		47.2	1	PENDING	0	1	121	112	0	\N	\N
253	Staff	\N	Dal Tadka		180	1	PREPARING	0	\N	123	120	0	\N	\N
254	Staff	\N	Chicken Biryani		336	2	PREPARING	0	\N	102	120	0	\N	\N
255	Staff	\N	Chicken Curry		312	2	PREPARING	0	\N	106	120	0	\N	\N
251	Staff	\N	Chapati		24	2	READY	0	\N	120	120	2	\N	\N
252	Staff	\N	Naan		48	2	READY	0	\N	121	120	2	\N	\N
269	Madhavan	\N	Chapati		24	1	PENDING	0	1	120	132	0	\N	\N
279	Waiter 	Main Course	Dal Tadka		150	1	PENDING	0	2	123	141	0	\N	\N
280	Waiter 	Main Course	Chole Bhature		160	1	PENDING	0	2	139	141	0	\N	\N
281	Waiter 	\N	Chapati		20	1	PREPARING	0	2	120	141	0	\N	\N
282	Waiter 	\N	Chicken Curry		260	1	PREPARING	0	2	106	141	0	\N	\N
283	Waiter 	Breads	Naan		40	1	READY	0	2	121	142	1	\N	\N
284	Waiter 	Breads	Parotta		30	1	READY	0	2	107	142	1	\N	\N
285	Waiter 	Starters	Fish Fry		280	1	READY	0	2	109	142	1	\N	\N
286	Waiter 	\N	Chapati		20	1	READY	0	2	120	142	1	\N	\N
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, bill_printed, bill_requested, bill_requested_at, created_at, customer_name, customer_phone, discount_amount, discount_type, discount_value, is_offline, kot_printed_at, notes, offline_id, order_number, order_type, payment_method, payment_status, status, subtotal, synced_at, table_number, tax_amount, token_number, total, updated_at, waiter_name, created_by, restaurant_id, merged_tables, covers) FROM stdin;
15	f	f	\N	2026-03-19 11:18:09.111368	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0014	DINE_IN	PENDING	UNPAID	PAID	280	\N	Table 1	0	1	280	2026-03-19 11:18:28.333082	Madhavan	1	1	\N	\N
1	f	f	\N	2026-03-15 00:02:57.976595	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0001	DINE_IN	PENDING	UNPAID	PAID	550	\N	Table 1	0	\N	550	2026-03-15 00:28:50.059302	Madhavan	1	1	\N	\N
2	f	f	\N	2026-03-15 00:31:34.482621	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0002	DINE_IN	PENDING	UNPAID	PAID	350	\N	Table 1	0	\N	350	2026-03-15 00:32:02.178509	Madhavan	1	1	\N	\N
3	f	f	\N	2026-03-15 00:32:06.82472	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0003	DINE_IN	PENDING	UNPAID	PAID	550	\N	Table 1	0	\N	550	2026-03-15 00:32:14.098042	Madhavan	1	1	\N	\N
4	f	f	\N	2026-03-18 18:01:21.554361	\N	\N	0	NONE	0	f	\N		\N	ORD0004	DINE_IN	PENDING	UNPAID	PAID	500	\N	Table 1	25	\N	525	2026-03-18 18:21:31.833923	Waiter 	2	1	\N	\N
5	f	f	\N	2026-03-18 18:23:13.469596	\N	\N	0	NONE	0	f	\N		\N	ORD0005	DINE_IN	PENDING	UNPAID	PAID	150	\N	Table 1	7.5	\N	157.5	2026-03-18 18:26:55.412527	Waiter 	2	1	\N	\N
17	f	f	\N	2026-03-19 11:37:36.188556	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0016	TAKEAWAY	PENDING	UNPAID	PAID	280	\N	Takeaway	0	3	280	2026-03-19 11:48:50.583354	Madhavan	1	1	\N	\N
18	f	f	\N	2026-03-19 11:42:34.609674	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0017	TAKEAWAY	PENDING	UNPAID	PAID	50	\N	Takeaway	0	4	50	2026-03-19 11:48:56.107634	Madhavan	1	1	\N	\N
6	f	f	\N	2026-03-18 18:27:04.005594	\N	\N	0	NONE	0	f	\N		\N	ORD0006	DINE_IN	PENDING	UNPAID	PAID	200	\N	Table 2	0	\N	200	2026-03-18 19:57:20.34247	Waiter 	2	1	\N	\N
7	f	f	\N	2026-03-18 19:57:44.564827	\N	\N	0	NONE	0	f	\N		\N	ORD0007	DINE_IN	PENDING	UNPAID	PAID	200	\N	Table 1	10	\N	210	2026-03-18 20:54:17.103616	Waiter 	2	1	\N	\N
8	f	f	\N	2026-03-18 19:58:35.660123	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0008	DINE_IN	PENDING	UNPAID	PAID	200	\N	Table 2	0	\N	200	2026-03-18 20:54:24.89307	Madhavan	1	1	\N	\N
16	f	f	\N	2026-03-19 11:29:27.728098	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0015	TAKEAWAY	PENDING	UNPAID	PAID	280	\N	Takeaway	0	2	280	2026-03-19 11:49:00.797697	Madhavan	1	1	\N	\N
9	f	f	\N	2026-03-18 20:57:31.960622	\N	\N	0	NONE	0	f	\N		\N	ORD0009	DINE_IN	PENDING	UNPAID	PAID	500	\N	Table 1	25	\N	525	2026-03-18 21:03:32.366761	Waiter 	2	1	\N	\N
10	f	f	\N	2026-03-18 21:03:43.775139	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0010	DINE_IN	PENDING	UNPAID	PAID	350	\N	Table 3	0	\N	350	2026-03-18 21:21:15.893115	Madhavan	1	1	\N	\N
23	f	f	\N	2026-03-19 19:54:05.581935	Madhavan	9710082916	0	NONE	0	f	\N	\N	\N	ORD0022	DINE_IN	PENDING	UNPAID	PAID	560	\N	Table 4	0	9	560	2026-03-19 20:49:26.630353	Table QR	\N	1	\N	\N
11	f	f	\N	2026-03-18 21:21:21.418821	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0011	DINE_IN	PENDING	UNPAID	PAID	500	\N	Table 1	0	\N	500	2026-03-18 21:22:51.247746	Madhavan	1	1	\N	\N
12	f	f	\N	2026-03-18 21:29:33.658141	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0012	DINE_IN	PENDING	UNPAID	PAID	200	\N	Table 2	0	\N	200	2026-03-18 21:29:54.473104	Madhavan	1	1	\N	\N
14	f	f	\N	2026-03-19 11:13:22.066465	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0013	TAKEAWAY	PENDING	UNPAID	PAID	540	\N	Takeaway	0	\N	540	2026-03-19 11:18:03.634792	Madhavan	1	1	\N	\N
20	f	f	\N	2026-03-19 11:55:36.301324	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0019	TAKEAWAY	PENDING	UNPAID	PAID	250	\N	Takeaway	0	6	250	2026-03-19 11:57:25.086702	Madhavan	1	1	\N	\N
21	f	f	\N	2026-03-19 11:56:19.410302	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0020	TAKEAWAY	PENDING	UNPAID	PAID	280	\N	Takeaway	0	7	280	2026-03-19 11:57:41.158941	Madhavan	1	1	\N	\N
19	f	f	\N	2026-03-19 11:52:28.028788	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0018	DINE_IN	PENDING	UNPAID	PAID	350	\N	Takeaway-T5	0	5	350	2026-03-19 11:59:25.665169	Madhavan	1	1	\N	\N
24	f	f	\N	2026-03-19 19:55:29.138308	Madhavan	9710082916	0	NONE	0	f	\N	\N	\N	ORD0023	DINE_IN	PENDING	UNPAID	PAID	0	\N	Table 5	0	10	0	2026-03-19 20:49:14.152354	Table QR	\N	1	\N	\N
22	f	f	\N	2026-03-19 19:46:42.061875	Madhavan	9710082916	0	NONE	0	f	\N	\N	\N	ORD0021	DINE_IN	PENDING	UNPAID	PAID	220	\N	Table 4	0	8	220	2026-03-19 20:49:18.450543	Table QR	\N	1	\N	\N
28	f	f	\N	2026-03-19 21:44:35.4933	Madhavan	9710082916	0	NONE	0	f	\N		\N	ORD0027	DINE_IN	PENDING	UNPAID	PAID	0	\N	Table 4	0	14	0	2026-03-19 22:03:14.681539	Table QR	\N	1	\N	\N
26	f	t	2026-03-19 21:34:59.697155	2026-03-19 21:32:43.281199	Madhavan	9710082916	0	NONE	0	f	\N		\N	ORD0025	DINE_IN	PENDING	UNPAID	PAID	0	\N	Table 4	0	12	0	2026-03-19 21:38:00.849211	Table QR	\N	1	\N	\N
25	f	f	\N	2026-03-19 20:49:56.92113	Madhavan	9710082916	0	NONE	0	f	\N	\N	\N	ORD0024	DINE_IN	PENDING	UNPAID	PAID	0	\N	Table 5	0	11	0	2026-03-19 21:38:05.938317	Table QR	\N	1	\N	\N
27	f	f	\N	2026-03-19 21:44:14.68695	Madhavan	9710082916	0	NONE	0	f	\N		\N	ORD0026	DINE_IN	PENDING	UNPAID	PAID	0	\N	Table 4	0	13	0	2026-03-19 22:03:10.497827	Table QR	\N	1	\N	\N
37	f	f	\N	2026-03-19 23:57:11.821681	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0001	DINE_IN	PENDING	UNPAID	PAID	80	\N	Table 1	0	1	80	2026-03-19 23:58:55.438273	Saravana	5	5	\N	\N
38	f	f	\N	2026-03-19 23:57:32.921717	Madhavan	9710082916	0	NONE	0	f	\N		\N	ORD0002	DINE_IN	PENDING	UNPAID	PAID	90	\N	Table 2	0	2	90	2026-03-19 23:59:00.25765	Table QR	\N	5	\N	\N
42	f	f	\N	2026-03-20 12:55:56.413104	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0031	DINE_IN	PENDING	UNPAID	PAID	260	\N	Table 1	0	4	260	2026-03-20 12:56:12.731192	Madhavan	1	1	\N	\N
39	f	f	\N	2026-03-20 11:31:17.639366	\N	\N	0	NONE	0	f	\N		\N	ORD0028	DINE_IN	PENDING	UNPAID	PAID	240	\N	Table 1	0	1	240	2026-03-20 11:36:46.98739	Waiter 	2	1	\N	\N
40	f	f	\N	2026-03-20 12:40:53.869214	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0029	DINE_IN	PENDING	UNPAID	PAID	310	\N	Table 1	0	2	310	2026-03-20 12:41:33.471345	Madhavan	1	1	\N	\N
41	f	f	\N	2026-03-20 12:46:36.047554	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0030	DINE_IN	PENDING	UNPAID	PAID	280	\N	Table 2	0	3	280	2026-03-20 12:46:51.436723	Madhavan	1	1	\N	\N
43	f	f	\N	2026-03-20 12:57:42.109108	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0032	DINE_IN	PENDING	UNPAID	PAID	270	\N	Table 1	0	5	270	2026-03-20 12:58:05.786517	Madhavan	1	1	\N	\N
44	f	f	\N	2026-03-20 13:18:46.359309	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0033	DINE_IN	PENDING	UNPAID	PAID	280	\N	Table 4	0	6	280	2026-03-20 13:18:54.833021	Madhavan	1	1	\N	\N
45	f	f	\N	2026-03-20 13:28:19.143787	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0034	DINE_IN	PENDING	UNPAID	PAID	480	\N	Table 1	0	7	480	2026-03-20 13:28:24.348526	Madhavan	1	1	\N	\N
46	f	f	\N	2026-03-20 13:35:42.434174	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0035	TAKEAWAY	PENDING	UNPAID	PAID	1270	\N	Takeaway	0	8	1270	2026-03-20 13:35:53.199048	Madhavan	1	1	\N	\N
47	f	f	\N	2026-03-20 13:36:39.047768	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0036	TAKEAWAY	PENDING	UNPAID	PAID	1870	\N	Takeaway	0	9	1870	2026-03-20 13:36:53.828359	Madhavan	1	1	\N	\N
68	f	f	\N	2026-03-24 11:26:21.754745	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0057	DINE_IN	PENDING	UNPAID	CANCELLED	360	\N	Table N-1	0	\N	360	2026-03-24 11:38:29.223268	Madhavan	1	1	\N	\N
48	f	f	\N	2026-03-20 13:37:59.959159	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0037	DINE_IN	PENDING	UNPAID	PAID	790	\N	Table 1	0	10	790	2026-03-20 13:38:11.125703	Madhavan	1	1	\N	\N
57	f	f	\N	2026-03-20 14:38:58.478669	\N	\N	0	NONE	0	f	\N		\N	ORD0046	DINE_IN	PENDING	UNPAID	PAID	2270	\N	Table 1	0	19	2270	2026-03-20 14:42:44.17176	Waiter 	2	1	\N	\N
123	f	f	\N	2026-04-17 16:20:34.828321	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776423034821	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 2	0	\N	0	2026-04-17 16:21:31.193596	\N	\N	1	\N	2
49	f	f	\N	2026-03-20 13:47:33.274935	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0038	DINE_IN	PENDING	UNPAID	PAID	730	\N	Table 1	0	11	730	2026-03-20 13:48:00.010777	Madhavan	1	1	\N	\N
50	f	f	\N	2026-03-20 13:47:50.092791	Customer	9600111551	0	NONE	0	f	\N		\N	ORD0039	DINE_IN	PENDING	UNPAID	PAID	590	\N	Table 4	0	12	590	2026-03-20 13:54:01.361825	Table QR	\N	1	\N	\N
58	t	f	\N	2026-03-20 14:39:11.454922	\N	\N	0	NONE	0	f	\N		\N	ORD0047	DINE_IN	PENDING	UNPAID	PAID	270	\N	Table 2	0	20	270	2026-03-20 15:52:32.039438	Waiter 	2	1	\N	\N
51	f	f	\N	2026-03-20 13:56:00.218729	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0040	DINE_IN	PENDING	UNPAID	PAID	990	\N	Table 2	0	13	990	2026-03-20 13:56:10.611607	Madhavan	1	1	\N	\N
52	f	f	\N	2026-03-20 13:58:53.978029	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0041	DINE_IN	PENDING	UNPAID	PAID	1380	\N	Table 1	0	14	1380	2026-03-20 13:59:04.358142	Madhavan	1	1	\N	\N
59	f	f	\N	2026-03-20 16:25:01.959793	\N	\N	0	NONE	0	f	\N		\N	ORD0048	DINE_IN	PENDING	UNPAID	PAID	740	\N	Table 2	0	21	740	2026-03-20 16:40:19.065267	Madhavan	1	1	\N	\N
53	f	f	\N	2026-03-20 14:02:27.077428	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0042	DINE_IN	PENDING	UNPAID	PAID	690	\N	Table 2	0	15	690	2026-03-20 14:02:35.905668	Madhavan	1	1	\N	\N
60	f	f	\N	2026-03-20 16:45:07.428961	\N	\N	0	NONE	0	f	\N		\N	ORD0049	DINE_IN	PENDING	UNPAID	PAID	540	\N	Table 1	0	22	540	2026-03-20 16:45:37.187912	Waiter 	2	1	\N	\N
54	f	f	\N	2026-03-20 14:31:02.018928	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0043	DINE_IN	PENDING	UNPAID	PAID	740	\N	Table 4	0	16	740	2026-03-20 14:31:14.22633	Madhavan	1	1	\N	\N
55	f	f	\N	2026-03-20 14:34:08.639222	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0044	DINE_IN	PENDING	UNPAID	PAID	1160	\N	Table 4	0	17	1160	2026-03-20 14:34:17.206223	Madhavan	1	1	\N	\N
61	f	f	\N	2026-03-20 16:46:57.22489	\N	\N	0	NONE	0	f	\N		\N	ORD0050	DINE_IN	PENDING	UNPAID	PAID	65	\N	Table 3	0	23	65	2026-03-20 16:47:25.189471	Waiter 	2	1	\N	\N
56	f	f	\N	2026-03-20 14:34:46.871599	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0045	DINE_IN	PENDING	UNPAID	PAID	800	\N	Table 8	0	18	800	2026-03-20 14:34:58.309314	Madhavan	1	1	\N	\N
76	f	f	\N	2026-03-24 14:40:44.854543	\N	\N	0	NONE	0	f	\N		\N	ORD0065	DINE_IN	PENDING	UNPAID	PAID	540	\N	Table 1	0	6	540	2026-03-25 09:27:07.402429	Waiter 	2	1	\N	\N
62	f	f	\N	2026-03-21 13:28:25.318055	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0051	DINE_IN	PENDING	UNPAID	PAID	330	\N	Table 2	0	1	330	2026-03-21 14:32:37.961249	Madhavan	1	1	\N	\N
63	f	f	\N	2026-03-21 13:49:41.128719	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0052	DINE_IN	PENDING	UNPAID	PAID	400	\N	Table N-2	0	\N	400	2026-03-21 14:45:13.921415	Madhavan	1	1	\N	\N
72	f	f	\N	2026-03-24 13:28:50.346556	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0061	DINE_IN	PENDING	UNPAID	CANCELLED	360	\N	Table N-1	0	\N	360	2026-03-24 13:43:25.372688	Madhavan	1	1	\N	\N
65	f	f	\N	2026-03-21 15:02:48.698078	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0054	DINE_IN	PENDING	UNPAID	PAID	580	\N	Table N-4	0	\N	580	2026-03-21 15:02:54.272555	Madhavan	1	1	\N	\N
64	f	f	\N	2026-03-21 14:57:33.508292	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0053	DINE_IN	PENDING	UNPAID	PAID	170	\N	Table 4	0	2	170	2026-03-21 15:03:52.982445	Madhavan	1	1	\N	\N
66	f	f	\N	2026-03-21 16:49:22.980247	\N	\N	0	NONE	0	f	\N		\N	ORD0055	DINE_IN	PENDING	UNPAID	CANCELLED	940	\N	Table 1	0	3	940	2026-03-23 22:55:06.604467	Waiter 	2	1	\N	\N
67	f	f	\N	2026-03-24 11:25:50.432776	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0056	DINE_IN	PENDING	UNPAID	CANCELLED	360	\N	Table 1	0	1	360	2026-03-24 11:26:21.7607	Madhavan	1	1	\N	\N
73	f	f	\N	2026-03-24 13:42:45.572863	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0062	DINE_IN	PENDING	UNPAID	CANCELLED	630	\N	Table 1 - Set 2	0	4	630	2026-03-24 13:43:28.204661	Madhavan	1	1	\N	\N
69	f	f	\N	2026-03-24 11:38:41.705057	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0058	DINE_IN	PENDING	UNPAID	PAID	360	\N	Table 1	0	2	360	2026-03-24 11:40:37.78605	Madhavan	1	1	\N	\N
70	f	f	\N	2026-03-24 11:38:48.114712	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0059	DINE_IN	PENDING	UNPAID	PAID	928	\N	Table N-1	0	\N	928	2026-03-24 11:41:25.353842	Madhavan	1	1	\N	\N
71	f	f	\N	2026-03-24 13:05:04.246544	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0060	DINE_IN	PENDING	UNPAID	PAID	36	\N	Table 1	0	3	36	2026-03-24 13:41:59.252507	Madhavan	1	1	\N	\N
75	f	f	\N	2026-03-24 13:46:58.454687	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0064	DINE_IN	PENDING	UNPAID	PAID	672	\N	Table 1 - Set 2	0	\N	672	2026-03-24 13:50:04.067948	Madhavan	1	1	\N	\N
74	f	f	\N	2026-03-24 13:43:41.890525	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0063	DINE_IN	PENDING	UNPAID	PAID	336	\N	Table 1	0	5	336	2026-03-24 13:51:29.220525	Madhavan	1	1	\N	\N
78	f	f	\N	2026-03-25 13:55:02.216127	\N	\N	0	NONE	0	f	\N		\N	ORD0067	DINE_IN	PENDING	UNPAID	PAID	240	\N	Table 1 - Set 2	0	2	240	2026-03-25 13:58:49.274127	Madhavan	1	1	\N	\N
77	f	f	\N	2026-03-25 13:54:23.387895	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0066	DINE_IN	PENDING	UNPAID	CANCELLED	396	\N	Table 1	0	1	396	2026-03-25 15:41:18.782026	Madhavan	1	1	\N	\N
79	t	f	\N	2026-03-25 15:46:43.761927	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0068	DINE_IN	PENDING	UNPAID	PAID	612	\N	Table 1	0	3	612	2026-03-25 16:04:45.640115	Madhavan	1	1	\N	\N
81	f	f	\N	2026-03-25 16:24:51.995445	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0070	DINE_IN	PENDING	UNPAID	CANCELLED	530	\N	Table 10 - Set 2	0	5	530	2026-03-25 16:25:18.474784	Madhavan	1	1	\N	\N
82	f	f	\N	2026-03-25 16:29:57.382728	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0071	DINE_IN	PENDING	UNPAID	CANCELLED	870	\N	Table 11	0	6	870	2026-03-25 16:30:21.816807	Madhavan	1	1	\N	\N
80	f	f	\N	2026-03-25 16:24:23.64035	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0069	DINE_IN	PENDING	UNPAID	PAID	1980	\N	Table 10	0	4	1980	2026-03-25 16:46:15.312967	Madhavan	1	1	\N	\N
83	t	f	\N	2026-03-25 16:49:19.127467	\N	\N	0	NONE	0	f	\N	\N	\N	ORD0072	DINE_IN	PENDING	UNPAID	CANCELLED	696	\N	Table 2	0	7	696	2026-03-25 22:57:54.777147	Bala	14	1	Table 1	\N
85	f	f	\N	2026-03-25 23:29:12.467502	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1774461552457	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 4	0	\N	0	2026-03-25 23:29:53.79371	\N	\N	1	Table 1	\N
135	f	f	\N	2026-05-02 08:02:13.640883	\N	\N	0	NONE	0	f	\N		\N	ORD1777688479263	DINE_IN	PENDING	UNPAID	PAID	60	\N	Table 1	0	1	60	2026-05-02 08:02:25.15611	Waiter 	2	1	\N	\N
122	f	f	\N	2026-04-17 15:29:55.53565	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776417215411	DINE_IN	PENDING	UNPAID	CANCELLED	72	\N	Table 2	0	6	72	2026-04-17 16:20:07.792653	Madhavan	1	1	\N	2
84	f	f	\N	2026-03-25 23:17:41.821634	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1774460861791	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 3	0	\N	0	2026-03-25 23:29:47.471486	\N	\N	1	\N	\N
124	f	f	\N	2026-04-17 16:24:12.052745	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776423252050	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 2	0	\N	0	2026-04-17 16:25:23.950046	\N	\N	1	\N	2
136	f	f	\N	2026-05-02 08:02:33.809751	\N	\N	0	NONE	0	f	\N		\N	ORD1777688479264	DINE_IN	PENDING	UNPAID	PAID	440	\N	Table 1	0	2	440	2026-05-02 08:02:55.150226	Waiter 	2	1	\N	\N
125	f	f	\N	2026-04-17 16:25:31.823018	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776423331823	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 2	0	\N	0	2026-04-17 16:25:35.785199	\N	\N	1	\N	2
126	f	f	\N	2026-04-17 16:26:04.571793	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776423331824	DINE_IN	PENDING	UNPAID	CANCELLED	72	\N	Table 2	0	7	72	2026-04-17 16:26:11.577181	Madhavan	1	1	\N	\N
137	f	f	\N	2026-05-02 08:02:44.153574	\N	\N	0	NONE	0	f	\N		\N	ORD1777688479265	DINE_IN	PENDING	UNPAID	PAID	60	\N	Table 1 - Set 2	0	3	60	2026-05-02 08:03:19.1346	Waiter 	2	1	\N	\N
128	f	f	\N	2026-04-20 14:08:29.056268	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776674308954	DINE_IN	PENDING	UNPAID	CANCELLED	1200	\N	Table 3	0	\N	1200	2026-04-20 14:29:17.991437	\N	\N	1	Table 2	2
138	f	f	\N	2026-05-02 08:03:32.522401	\N	\N	0	NONE	0	f	\N		\N	ORD1777688479266	DINE_IN	PENDING	UNPAID	PAID	60	\N	Table 1 - Set 2	0	4	60	2026-05-02 08:07:53.626538	Waiter 	2	1	\N	\N
129	f	f	\N	2026-04-20 14:29:37.335411	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776675577324	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 3	0	\N	0	2026-04-20 14:38:44.388458	\N	\N	1	\N	2
127	f	f	\N	2026-04-20 08:23:12.729541	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776423331825	DINE_IN	PENDING	UNPAID	PAID	72	\N	Table 1	0	1	72	2026-04-20 14:38:57.608043	Madhavan	1	1	\N	\N
130	f	f	\N	2026-04-20 14:43:13.077834	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776675577325	DINE_IN	PENDING	UNPAID	CANCELLED	72	\N	Table 2	0	2	72	2026-04-21 07:55:13.147933	Madhavan	1	1	\N	\N
131	f	f	\N	2026-04-21 07:59:20.758673	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776675577326	DINE_IN	PENDING	UNPAID	PAID	72	\N	Table 1	0	1	72	2026-04-21 07:59:47.943363	Madhavan	1	1	\N	\N
132	f	f	\N	2026-04-21 08:01:07.292188	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776675577327	DINE_IN	PENDING	UNPAID	CANCELLED	24	\N	Table 1	0	2	24	2026-04-21 08:10:52.453182	Madhavan	1	1	\N	\N
133	f	f	\N	2026-04-21 08:11:32.149122	\N	\N	0	NONE	0	f	\N	⏳ Kitchen needs 10 more mins. | ⏳ Kitchen needs 10 more mins.	\N	ORD1776675577328	DINE_IN	PENDING	UNPAID	CANCELLED	24	\N	Table 4	0	3	24	2026-04-21 08:15:49.989521	Madhavan	1	1	\N	\N
139	f	f	\N	2026-05-02 08:17:05.051878	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1777690025023	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 2	0	\N	0	2026-05-02 08:17:22.418434	\N	\N	1	\N	\N
134	f	f	\N	2026-05-02 07:51:19.276678	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1777688479262	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 2	0	\N	0	2026-05-02 07:52:35.924822	\N	\N	1	\N	\N
140	f	f	\N	2026-05-02 08:17:28.586236	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1777690048585	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 3	0	\N	0	2026-05-02 08:17:36.508655	\N	\N	1	\N	\N
141	f	f	\N	2026-05-02 08:18:55.687695	\N	\N	0	NONE	0	f	\N		\N	ORD1777690048586	DINE_IN	PENDING	UNPAID	PAID	590	\N	Table 1	0	5	605	2026-05-02 08:26:01.401114	Waiter 	2	1	\N	\N
142	f	f	\N	2026-05-02 08:26:19.194651	\N	\N	0	NONE	0	f	\N		\N	ORD1777690048587	DINE_IN	PENDING	UNPAID	PAID	370	\N	Table 2	0	6	370	2026-05-02 08:27:13.100337	Waiter 	2	1	\N	\N
118	t	f	\N	2026-04-17 14:13:33.629914	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776415202995	DINE_IN	PENDING	UNPAID	PAID	224.2	\N	Table 1	0	5	224.2	2026-04-17 14:59:21.517908	Madhavan	1	1	\N	\N
100	f	f	\N	2026-04-15 10:44:53.444834	\N	\N	0	NONE	0	f	\N		\N	ORD1774462715169	DINE_IN	PENDING	UNPAID	PAID	90	\N	Table 1	0	4	90	2026-04-15 11:40:16.301169	Waiter 	2	1	\N	\N
86	f	f	\N	2026-03-25 23:30:04.808216	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1774461604808	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 2	0	\N	0	2026-03-25 23:36:10.71557	\N	\N	1	\N	\N
110	f	f	\N	2026-04-16 14:09:24.857654	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776328241490	DINE_IN	PENDING	UNPAID	CANCELLED	240	\N	Table 6	0	2	240	2026-04-17 07:30:47.842817	Madhavan	1	1	\N	\N
87	f	f	\N	2026-03-25 23:36:20.407069	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1774461980407	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 3	0	\N	0	2026-03-25 23:48:28.351361	\N	\N	1	\N	\N
101	f	f	\N	2026-04-15 11:40:36.892049	\N	\N	0	NONE	0	f	\N		\N	ORD1774462715170	DINE_IN	PENDING	UNPAID	PAID	400	\N	Table 1	0	5	400	2026-04-15 11:42:32.023033	Waiter 	2	1	\N	\N
88	f	f	\N	2026-03-25 23:48:35.167256	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1774462715157	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 2	0	\N	0	2026-03-25 23:48:38.261508	\N	\N	1	\N	\N
91	f	f	\N	2026-03-27 00:09:38.280944		\N	0	NONE	0	f	\N	\N	\N	ORD1774462715160	DINE_IN	CASH	PAID	PAID	1000	\N	Takeaway	0	3	1000	2026-03-27 00:09:38.707464	Madhavan	1	1	\N	\N
92	f	f	\N	2026-03-27 00:10:02.326778		\N	0	NONE	0	f	\N	\N	\N	ORD1774462715161	DINE_IN	UPI	PAID	PAID	240	\N	Takeaway	0	4	240	2026-03-27 00:10:02.398159	Madhavan	1	1	\N	\N
90	f	f	\N	2026-03-27 00:07:49.318926		\N	0	NONE	0	f	\N	\N	\N	ORD1774462715159	DINE_IN	PENDING	UNPAID	CANCELLED	1000	\N	Takeaway	0	2	1000	2026-03-27 00:11:03.134454	Madhavan	1	1	\N	\N
89	f	f	\N	2026-03-27 00:07:24.55738		\N	0	NONE	0	f	\N	\N	\N	ORD1774462715158	DINE_IN	PENDING	UNPAID	CANCELLED	955	\N	Takeaway	0	1	955	2026-03-27 00:11:06.976165	Madhavan	1	1	\N	\N
93	f	f	\N	2026-03-27 00:11:25.882236		\N	0	NONE	0	f	\N	\N	\N	ORD1774462715162	DINE_IN	CASH	PAID	PAID	1372	\N	Takeaway	0	5	1372	2026-03-27 00:11:25.941482	Madhavan	1	1	\N	\N
94	f	f	\N	2026-03-27 00:27:28.76398		\N	0	NONE	0	f	\N	\N	\N	ORD1774462715163	DINE_IN	CASH	PAID	PAID	332	\N	Takeaway	0	6	332	2026-03-27 00:27:29.022193	Madhavan	1	1	\N	\N
95	f	f	\N	2026-03-27 07:20:38.997339		\N	0	NONE	0	f	\N	\N	\N	ORD1774462715164	DINE_IN	UPI	PAID	PAID	120	\N	Takeaway	0	7	120	2026-03-27 07:20:39.257003	Madhavan	1	1	\N	\N
96	f	f	\N	2026-03-31 11:45:42.441495	Customer	6385040369	0	NONE	0	f	\N	\N	\N	ORD1774462715165	DINE_IN	PENDING	UNPAID	PAID	540	\N	Table 4	0	1	540	2026-03-31 19:34:52.1762	Table QR	\N	1	\N	\N
97	f	f	\N	2026-04-15 08:50:23.439301	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1774462715166	DINE_IN	PENDING	UNPAID	PAID	696	\N	Table 1	0	1	696	2026-04-15 08:50:47.819253	Madhavan	1	1	\N	\N
98	f	f	\N	2026-04-15 09:41:50.104098	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1774462715167	DINE_IN	PENDING	UNPAID	CANCELLED	800	\N	Table 7	0	2	800	2026-04-15 10:02:28.142735	Madhavan	1	1	\N	\N
99	f	f	\N	2026-04-15 10:42:29.042723	\N	\N	0	NONE	0	f	\N		\N	ORD1774462715168	DINE_IN	PENDING	UNPAID	CANCELLED	60	\N	Table 1	0	3	60	2026-04-15 10:42:43.375939	Waiter 	2	1	\N	\N
102	f	f	\N	2026-04-15 11:44:44.425179	\N	\N	0	NONE	0	f	\N		\N	ORD1774462715171	DINE_IN	PENDING	UNPAID	PAID	60	\N	Table 2	0	6	60	2026-04-15 12:10:46.719535	Waiter 	2	1	\N	\N
103	f	f	\N	2026-04-15 14:53:22.754473	Madhavan M	9710082916	0	NONE	0	f	\N		\N	ORD1774462715172	DINE_IN	PENDING	UNPAID	PAID	520	\N	Table 4	0	7	520	2026-04-15 15:08:24.621806	Table QR	\N	1	\N	\N
104	f	f	\N	2026-04-15 15:08:47.754323	Madhavan M	9710082916	0	NONE	0	f	\N		\N	ORD1774462715173	DINE_IN	PENDING	UNPAID	CANCELLED	340	\N	Table 4	0	8	340	2026-04-15 15:15:21.334012	Table QR	\N	1	\N	\N
109	f	f	\N	2026-04-16 14:05:36.709122	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776328241489	DINE_IN	PENDING	UNPAID	CANCELLED	501.6	\N	Table 5	0	1	511.6	2026-04-17 07:30:52.889526	Madhavan	1	1	\N	\N
105	f	f	\N	2026-04-15 15:15:44.317327	Madhavan M	9710082916	0	NONE	0	f	\N		\N	ORD1774462715174	DINE_IN	PENDING	UNPAID	CANCELLED	410	\N	Table 4	0	9	410	2026-04-15 15:22:23.306331	Table QR	\N	1	\N	\N
106	f	t	2026-04-15 15:53:22.218637	2026-04-15 15:22:35.804446	Madhavan M	9710082916	0	NONE	0	f	\N		\N	ORD1774462715175	DINE_IN	PENDING	UNPAID	PAID	800	\N	Table 4	0	10	800	2026-04-15 15:53:34.709881	Table QR	\N	1	\N	\N
111	f	f	\N	2026-04-17 07:31:21.643986	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776328241491	DINE_IN	PENDING	UNPAID	CANCELLED	70.80000000000001	\N	Table 1	0	1	70.80000000000001	2026-04-17 07:31:30.465145	Madhavan	1	1	\N	\N
112	f	f	\N	2026-04-17 08:41:04.331775	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776328241492	DINE_IN	PENDING	UNPAID	CANCELLED	70.80000000000001	\N	Table 1	0	2	70.80000000000001	2026-04-17 08:48:58.420499	Madhavan	1	1	\N	\N
107	f	f	\N	2026-04-16 13:58:56.347239	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776328135899	DINE_IN	PENDING	UNPAID	PAID	72	\N	Table 2	0	\N	72	2026-04-16 15:39:13.856073	\N	\N	1	Table 1	\N
108	f	f	\N	2026-04-16 14:00:41.491694	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776328241488	DINE_IN	PENDING	UNPAID	PAID	0	\N	Table 4	0	\N	0	2026-04-16 16:35:29.565057	\N	\N	1	Table 3	\N
116	f	f	\N	2026-04-17 14:10:58.231691	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776415202993	DINE_IN	PENDING	UNPAID	CANCELLED	70.80000000000001	\N	Table 1	0	3	70.80000000000001	2026-04-17 14:12:28.633717	Madhavan	1	1	\N	\N
113	f	f	\N	2026-04-17 14:08:33.082933	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776415112904	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 2	0	\N	0	2026-04-17 14:08:43.320924	\N	\N	1	\N	\N
114	f	f	\N	2026-04-17 14:09:16.201853	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776415156200	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 1	0	\N	0	2026-04-17 14:09:32.074893	\N	\N	1	\N	\N
115	f	f	\N	2026-04-17 14:10:02.994159	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776415202992	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 1	0	\N	0	2026-04-17 14:10:14.336427	\N	\N	1	\N	\N
117	f	f	\N	2026-04-17 14:12:46.349429	\N	\N	0	NONE	0	f	\N	\N	\N	ORD1776415202994	DINE_IN	PENDING	UNPAID	CANCELLED	306.8	\N	Table 1	0	4	306.8	2026-04-17 14:13:02.886472	Madhavan	1	1	\N	\N
119	f	f	\N	2026-04-17 14:26:36.734858	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776416196732	DINE_IN	PENDING	UNPAID	CANCELLED	72	\N	Table 3	0	\N	72	2026-04-17 14:42:47.883085	\N	\N	1	Table 2, Table 8	\N
120	f	f	\N	2026-04-17 14:43:18.965988	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776417198963	DINE_IN	PENDING	UNPAID	PAID	1620	\N	Table 3	0	\N	1620	2026-04-17 14:55:14.595057	\N	\N	1	Table 2, Table 10	\N
121	f	f	\N	2026-04-17 14:43:35.410055	\N	\N	0	NONE	0	f	\N	\N	\N	TEMP-1776417215410	DINE_IN	PENDING	UNPAID	CANCELLED	0	\N	Table 15	0	\N	0	2026-04-17 14:43:54.91778	\N	\N	1	\N	\N
\.


--
-- Data for Name: queue_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.queue_entries (id, allocated_table, created_at, customer_name, customer_phone, party_size, status, token_number, updated_at, restaurant_id) FROM stdin;
1	\N	2026-03-31 20:55:32.380891	Madhavan 	9710082916	2	SEATED	T-1	2026-03-31 21:51:04.103636	1
2	\N	2026-03-31 21:38:27.766285	Madhavan M	9710082916	4	SEATED	T-2	2026-03-31 21:51:32.380775	1
3	\N	2026-03-31 21:52:05.898102	Joe	9710082916	2	SEATED	T-3	2026-03-31 21:52:32.335826	1
\.


--
-- Data for Name: stakeholder_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stakeholder_mappings (id, assigned_at, is_active, share_percentage, restaurant_id, stakeholder_id) FROM stdin;
1	2026-04-11 10:47:51.287417	t	50	5	5
3	2026-04-11 10:47:51.313598	t	50	16	5
4	2026-04-11 10:47:51.322087	t	50	17	5
7	2026-04-11 11:03:38.231566	t	50	16	1
8	2026-04-11 11:03:38.264069	t	50	17	1
9	2026-04-11 11:03:38.272994	t	50	1	1
10	2026-04-11 11:03:38.281542	t	30	17	19
11	2026-04-15 10:40:14.055019	t	25	1	22
2	2026-04-11 10:47:51.304326	f	50	1	5
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movements (id, quantity, reason, "timestamp", type, inventory_item_id, order_id, performed_by, movement_timestamp, restaurant_id) FROM stdin;
1	2	sweet	2026-03-26 08:27:08.957392	DEDUCT	1	\N	1	\N	\N
2	2	sweet	\N	DEDUCT	1	\N	1	2026-03-26 08:41:59.191748	1
3	50	Initial stock intake	\N	ADD	2	\N	\N	2026-03-26 23:16:42.127041	1
4	100	Initial stock intake	\N	ADD	3	\N	\N	2026-03-26 23:16:42.568791	1
5	150	Initial stock intake	\N	ADD	4	\N	\N	2026-03-26 23:16:42.606459	1
6	20	Initial stock intake	\N	ADD	5	\N	\N	2026-03-26 23:16:42.694639	1
7	40	Initial stock intake	\N	ADD	6	\N	\N	2026-03-26 23:16:42.749558	1
8	30	Initial stock intake	\N	ADD	7	\N	\N	2026-03-26 23:16:42.788458	1
9	25	Initial stock intake	\N	ADD	8	\N	\N	2026-03-26 23:16:42.860157	1
10	40	Initial stock intake	\N	ADD	9	\N	\N	2026-03-26 23:16:42.91052	1
11	35	Initial stock intake	\N	ADD	10	\N	\N	2026-03-26 23:16:42.99163	1
12	60	Initial stock intake	\N	ADD	11	\N	\N	2026-03-26 23:16:43.043954	1
13	80	Initial stock intake	\N	ADD	12	\N	\N	2026-03-26 23:16:43.09497	1
14	45	Initial stock intake	\N	ADD	13	\N	\N	2026-03-26 23:16:43.131362	1
15	60	Initial stock intake	\N	ADD	14	\N	\N	2026-03-26 23:16:43.172301	1
16	20	Initial stock intake	\N	ADD	15	\N	\N	2026-03-26 23:16:43.210386	1
17	35	Initial stock intake	\N	ADD	16	\N	\N	2026-03-26 23:16:43.246125	1
18	50	Initial stock intake	\N	ADD	17	\N	\N	2026-03-26 23:31:28.047817	1
19	100	Initial stock intake	\N	ADD	18	\N	\N	2026-03-26 23:31:28.187176	1
20	150	Initial stock intake	\N	ADD	19	\N	\N	2026-03-26 23:31:28.257262	1
21	20	Initial stock intake	\N	ADD	20	\N	\N	2026-03-26 23:31:28.314939	1
22	40	Initial stock intake	\N	ADD	21	\N	\N	2026-03-26 23:31:28.354696	1
23	30	Initial stock intake	\N	ADD	22	\N	\N	2026-03-26 23:31:28.393715	1
24	25	Initial stock intake	\N	ADD	23	\N	\N	2026-03-26 23:31:28.441491	1
25	40	Initial stock intake	\N	ADD	24	\N	\N	2026-03-26 23:31:28.482772	1
26	35	Initial stock intake	\N	ADD	25	\N	\N	2026-03-26 23:31:28.532328	1
27	60	Initial stock intake	\N	ADD	26	\N	\N	2026-03-26 23:31:28.58363	1
28	80	Initial stock intake	\N	ADD	27	\N	\N	2026-03-26 23:31:28.630146	1
29	45	Initial stock intake	\N	ADD	28	\N	\N	2026-03-26 23:31:28.66067	1
30	60	Initial stock intake	\N	ADD	29	\N	\N	2026-03-26 23:31:28.698401	1
31	20	Initial stock intake	\N	ADD	30	\N	\N	2026-03-26 23:31:28.732088	1
32	35	Initial stock intake	\N	ADD	31	\N	\N	2026-03-26 23:31:28.767067	1
33	50	Initial stock intake	\N	ADD	32	\N	\N	2026-03-26 23:42:44.40262	1
34	100	Initial stock intake	\N	ADD	33	\N	\N	2026-03-26 23:42:44.487693	1
35	150	Initial stock intake	\N	ADD	34	\N	\N	2026-03-26 23:42:44.529307	1
36	20	Initial stock intake	\N	ADD	35	\N	\N	2026-03-26 23:42:44.58013	1
37	40	Initial stock intake	\N	ADD	36	\N	\N	2026-03-26 23:42:44.626785	1
38	30	Initial stock intake	\N	ADD	37	\N	\N	2026-03-26 23:42:44.68594	1
39	25	Initial stock intake	\N	ADD	38	\N	\N	2026-03-26 23:42:44.729013	1
40	40	Initial stock intake	\N	ADD	39	\N	\N	2026-03-26 23:42:44.775106	1
41	35	Initial stock intake	\N	ADD	40	\N	\N	2026-03-26 23:42:44.804373	1
42	60	Initial stock intake	\N	ADD	41	\N	\N	2026-03-26 23:42:44.852858	1
43	80	Initial stock intake	\N	ADD	42	\N	\N	2026-03-26 23:42:44.913516	1
44	45	Initial stock intake	\N	ADD	43	\N	\N	2026-03-26 23:42:44.972626	1
45	60	Initial stock intake	\N	ADD	44	\N	\N	2026-03-26 23:42:45.007546	1
46	20	Initial stock intake	\N	ADD	45	\N	\N	2026-03-26 23:42:45.052709	1
47	35	Initial stock intake	\N	ADD	46	\N	\N	2026-03-26 23:42:45.099733	1
48	2	Initial stock intake	\N	ADD	47	\N	\N	2026-03-27 11:56:45.908179	1
49	2	Initial stock intake	\N	ADD	48	\N	\N	2026-03-27 11:56:46.002051	1
50	2	Initial stock intake	\N	ADD	49	\N	\N	2026-03-27 11:56:46.043587	1
51	2	Initial stock intake	\N	ADD	50	\N	\N	2026-03-27 11:56:46.084042	1
52	2	Initial stock intake	\N	ADD	51	\N	\N	2026-03-27 11:56:46.120719	1
53	2	Initial stock intake	\N	ADD	52	\N	\N	2026-03-27 11:56:46.149725	1
54	2	Initial stock intake	\N	ADD	53	\N	\N	2026-03-27 11:56:46.184176	1
55	2	Initial stock intake	\N	ADD	54	\N	\N	2026-03-27 11:56:46.223667	1
56	2	Initial stock intake	\N	ADD	55	\N	\N	2026-03-27 11:56:46.25006	1
57	2	Initial stock intake	\N	ADD	56	\N	\N	2026-03-27 11:56:46.287799	1
58	2	Initial stock intake	\N	ADD	57	\N	\N	2026-03-27 11:56:46.324387	1
59	2	Initial stock intake	\N	ADD	58	\N	\N	2026-03-27 11:56:46.363127	1
60	2	Initial stock intake	\N	ADD	59	\N	\N	2026-03-27 11:56:46.398251	1
61	2	Initial stock intake	\N	ADD	60	\N	\N	2026-03-27 11:56:46.434153	1
62	2	Initial stock intake	\N	ADD	61	\N	\N	2026-03-27 11:56:46.468227	1
63	2	Initial stock intake	\N	ADD	62	\N	\N	2026-03-27 11:57:21.793713	1
64	2	Initial stock intake	\N	ADD	63	\N	\N	2026-03-27 11:57:21.843285	1
65	2	Initial stock intake	\N	ADD	64	\N	\N	2026-03-27 11:57:21.923366	1
66	2	Initial stock intake	\N	ADD	65	\N	\N	2026-03-27 11:57:21.983661	1
67	2	Initial stock intake	\N	ADD	66	\N	\N	2026-03-27 11:57:22.018412	1
68	2	Initial stock intake	\N	ADD	67	\N	\N	2026-03-27 11:57:22.063199	1
69	2	Initial stock intake	\N	ADD	68	\N	\N	2026-03-27 11:57:22.122678	1
70	2	Initial stock intake	\N	ADD	69	\N	\N	2026-03-27 11:57:22.183709	1
71	2	Initial stock intake	\N	ADD	70	\N	\N	2026-03-27 11:57:22.221704	1
72	2	Initial stock intake	\N	ADD	71	\N	\N	2026-03-27 11:57:22.258117	1
73	2	Initial stock intake	\N	ADD	72	\N	\N	2026-03-27 11:57:22.30543	1
74	2	Initial stock intake	\N	ADD	73	\N	\N	2026-03-27 11:57:22.396211	1
75	2	Initial stock intake	\N	ADD	74	\N	\N	2026-03-27 11:57:22.437536	1
76	2	Initial stock intake	\N	ADD	75	\N	\N	2026-03-27 11:57:22.467226	1
77	2	Initial stock intake	\N	ADD	76	\N	\N	2026-03-27 11:57:22.496865	1
78	2	Initial stock intake	\N	ADD	78	\N	\N	2026-03-27 13:43:51.522879	1
79	2	Initial stock intake	\N	ADD	79	\N	\N	2026-03-27 13:43:51.623311	1
80	2	Initial stock intake	\N	ADD	80	\N	\N	2026-03-27 13:43:51.658335	1
81	2	Initial stock intake	\N	ADD	81	\N	\N	2026-03-27 13:43:51.697541	1
82	2	Initial stock intake	\N	ADD	82	\N	\N	2026-03-27 13:43:51.739428	1
83	2	Initial stock intake	\N	ADD	83	\N	\N	2026-03-27 13:43:51.804577	1
84	2	Initial stock intake	\N	ADD	84	\N	\N	2026-03-27 13:43:51.857394	1
85	2	Initial stock intake	\N	ADD	85	\N	\N	2026-03-27 13:43:51.894082	1
86	2	Initial stock intake	\N	ADD	86	\N	\N	2026-03-27 13:43:51.919618	1
87	2	Initial stock intake	\N	ADD	87	\N	\N	2026-03-27 13:43:51.947085	1
88	2	Initial stock intake	\N	ADD	88	\N	\N	2026-03-27 13:43:51.968328	1
89	2	Initial stock intake	\N	ADD	89	\N	\N	2026-03-27 13:43:51.989695	1
90	2	Initial stock intake	\N	ADD	90	\N	\N	2026-03-27 13:43:52.034613	1
91	2	Initial stock intake	\N	ADD	91	\N	\N	2026-03-27 13:43:52.062971	1
92	2	Initial stock intake	\N	ADD	92	\N	\N	2026-03-27 13:43:52.085773	1
93	10	Initial stock intake	\N	ADD	93	\N	\N	2026-03-27 15:50:55.932446	1
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, amount, category, date, description, payment_method, reference_id, type, restaurant_id) FROM stdin;
\.


--
-- Data for Name: user_assigned_tables; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_assigned_tables (user_id, table_number) FROM stdin;
6	Table 1
6	Table 2
6	Table 3
6	Table 4
2	Table 1
2	Table 6
2	Table 11
2	Table 16
2	1
2	6
2	11
2	16
13	1
13	11
13	16
13	6
14	8
14	9
14	10
28	2
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, address, created_at, currency, email, geofence_radius, is_active, latitude, logo, longitude, name, onboarding_completed, onboarding_step, password, phone, restaurant_name, role, subscription_active, subscription_expires_at, subscription_plan, subscription_started_at, tax_rate, updated_at, parent_owner_id, total_tables, otp, otp_expires_at, gst_number, allow_no_stock_sale, auto_print_enabled, bill_printer_enabled, category_printer_enabled, consolidated_receipt, item_wise_kot, kot_printer_enabled, large_font_kot, low_stock_alert, manual_quantity, menu_color_style, menu_item_column_count, menu_layout, min_print_price, print_count, quick_mode, reprint_bill, reprint_kot, track_customer_detail, online_auto_accept, online_auto_print, online_notification, online_print_counter, online_print_kitchen, online_stock_activate_time, whatsapp_country_code, whatsapp_detailed_bill, counter_printer_ip, kitchen_printer_ip, ac_charge_percentage, ac_tables, table_metadata, table_categories, is_probloom_admin, license_key, license_type, preferred_pos_mode, preferred_language, print_language, accent_color, is_approved, business_type, outlets_count, requested_plan, temp_password) FROM stdin;
4	\N	2026-03-19 19:13:50.75992	INR	9710082919@customer.com	500	t	\N	\N	\N	Customer	f	1	$2a$12$NaGSxPGzB0hBb7u4kPNab.y55TVN5JjwC/IMhIByn4EHceWdjoPaq	9710082919	Kitchen Master	CUSTOMER	t	2026-04-18 19:13:50.718926	FREE	2026-03-19 19:13:50.718926	5	2026-03-19 19:13:50.75992	\N	10	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6	\N	2026-03-19 23:18:20.828496	INR	vegw@gmail.com	500	t	\N	\N	\N	Waiter	t	1	$2a$12$wHqw0jKyF7IG.GY2v0rhs.ZCgGpZgBkCvJcQKw062tIArZczF00HG	\N	Bhavan	WAITER	t	2026-04-18 23:18:20.824265	FREE	2026-03-19 23:18:20.824265	5	2026-03-19 23:18:20.828496	5	10	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
18	\N	2026-03-31 11:45:37.346426	INR	6385040369@customer.com	500	t	\N	\N	\N	Customer	f	1	$2a$12$ekJ3umDQD0T9Jf3Lzqy0XOH0ViN/mn1YzEc89wcuCIjcscKxUKIOS	6385040369	Kitchen Master	CUSTOMER	t	2026-04-30 11:45:37.294346	FREE	2026-03-31 11:45:37.294346	5	2026-03-31 11:45:37.346426	\N	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	\N	\N	\N	\N	\N	\N	\N	\N
19	\N	2026-04-11 10:47:51.176136	INR	7401813016@stakeholder.com	500	t	\N	\N	\N	Madhavan Regional Investor	f	1	$2a$12$LHMDN3jyhe5G82e7zHh2Ie3YCTWYwQW4Wy0BjqMegVbWqH7/UPmPu	7401813016	Regional Investor	STAKEHOLDER	t	2026-05-11 10:47:51.159642	FREE	2026-04-11 10:47:51.159642	5	2026-04-11 11:03:38.138743	\N	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	\N	\N	\N	\N	\N	\N	\N	\N
7	\N	2026-03-20 13:47:39.814487	INR	9600111551@customer.com	500	t	\N	\N	\N	Customer	f	1	$2a$12$siriCcqKG6LzUmtMTQIgsueTYzXINRGPJWM4Pt6FMyA5jeaxQudda	9600111551	Kitchen Master	CUSTOMER	t	2026-04-19 13:47:39.764174	FREE	2026-03-20 13:47:39.764174	5	2026-03-20 13:47:39.814487	\N	10	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
14	\N	2026-03-25 16:39:48.897827	INR	bala@gmail.com	500	t	\N	\N	\N	Bala	t	1	$2a$12$/c9sAv1G58IuxdZC1ZRD/.P8FwiNovuWplCwy1PxR2Zlm7iZRs512	\N	BBQ	MANAGER	t	2026-04-24 16:39:48.897827	FREE	2026-03-25 16:39:48.897827	5	2026-04-16 14:14:58.644952	1	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
16	\N	2026-03-28 21:26:50.537482	INR	admin@probloom.com	500	t	\N	\N	\N	ProBloom Admin	t	1	$2a$12$zh/vdbKac4qJAbrCeYnADevaaGYm2WFxkXLaSfhAeAK8HMTzyi5gK	\N	ProBloom HQ	OWNER	t	2126-03-28 21:26:50.505822	ENTERPRISE	2026-03-28 21:26:50.505822	5	2026-03-28 21:26:50.537482	\N	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	t	\N	digital	\N	\N	\N	\N	\N	\N	\N	\N	\N
5	3Q9J+3HH, Vazhaiyur, Tamil Nadu, 621104	2026-03-19 23:16:35.553665	INR	veg@gmail.com	500	t	11.0684386	\N	78.781085	Saravana	t	3	$2a$12$F2A2ofqPATQmr.aiS6vHmONuPhDQQJeVMkjpt.PGsNJYDLHySRI2S	9710082916	Bhavan	STAKEHOLDER	t	2027-04-18 23:16:35.531505	FREE	2026-03-19 23:16:35.531505	5	2026-04-11 10:55:56.03058	\N	6	\N	\N		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
17	\N	2026-03-28 22:19:09.048696	INR	kfc@gmail.com	500	t	\N	\N	\N	Vasantha Kumar	t	1	$2a$12$Gd8DddlX5EJ9bR4xllPrgeJb1gdukwEbNFnJ3yrisCc7aDjqEgHb.	9710082916	KFC	OWNER	t	2027-03-28 22:19:09.04204	ENTERPRISE	2026-03-28 22:19:09.02751	5	2026-04-20 14:03:26.008027	\N	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	MTc6a2ZjQGdtYWlsLmNvbToyMDI3LTAzLTI4VDIyOjE5OjA5LjA0MjA0MDpyNndpVlVYOHIzTGNPdzdkTWNmT3RocytBZVpaYWkzWlEzSFFzYWZOTk44PQ==	prime	\N	\N	\N	\N	t	\N	\N	\N	\N
15	\N	2026-03-25 16:41:20.807274	INR	bala@ymail.com	500	t	\N	\N	\N	Rohan	t	1	$2a$12$zcB3qSqPZBOykTS3TCr15O/Gz0GPMd5c3EHFbW.IovGDI7luQ2TBO	\N	BBQ	KITCHEN	t	2026-04-24 16:41:20.807275	FREE	2026-03-25 16:41:20.807275	5	2026-05-01 10:01:19.911175	1	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2	Coimbatore, Coimbatore North, Coimbatore, Tamil Nadu, 641001, India	2026-03-14 12:17:42.387188	INR	waiter@gmail.com	500	t	\N	\N	\N	Waiter 	t	1	$2a$12$dZHCh0hLIsgmTODGMTEcv.7PHHA43.LtrUwboElCuEJa6braPI0Ua	9876543210	BBQ	WAITER	t	2026-04-13 12:17:42.352208	FREE	2026-03-14 12:17:42.352208	5	2026-04-15 16:11:58.260692	1	20	\N	\N	1234567889	t	f	t	\N	f	f	t	f	t	t	\N	5	Top Menu	0	1	t	f	f	t	f	f	t	t	t	f	+91 9710082916	t			20	1,2,3,4,5	{"1":{"seats":"4","location":"Ground Floor"},"2":{"seats":"6","location":"Ground Floor"},"3":{"seats":"10","location":"Ground Floor"},"4":{"seats":"4","location":"Ground Floor"},"5":{"location":"Ground Floor"},"6":{"location":"Ground Floor"},"7":{"seats":"5","location":"Ground Floor"},"8":{"location":"Ground Floor"},"9":{"location":"Ground Floor"},"10":{"location":"Ground Floor"},"11":{"location":"First Floor"},"12":{"location":"First Floor"},"13":{"location":"First Floor"},"14":{"location":"First Floor"},"15":{"location":"First Floor"},"16":{"location":"First Floor"},"17":{"location":"First Floor"},"18":{"location":"First Floor"},"19":{"location":"Party Hall"},"20":{"location":"Party Hall"}}	["Ground Floor","First Floor","Party Hall"]	\N	\N	\N	restaurant	en	en	\N	\N	\N	\N	\N	\N
13	\N	2026-03-25 16:37:34.483053	INR	Bala@gmail.com	500	f	\N	\N	\N	Bala	t	1	$2a$12$elLsBBb5lzGssdUf7uHENe/Y.a23vBvv5X.pJJqmwgJ1iR0MX9liC	\N	BBQ	WAITER	t	2026-04-24 16:37:34.483053	FREE	2026-03-25 16:37:34.483053	5	2026-03-25 16:37:38.592226	1	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
20	\N	2026-04-13 11:30:44.996723	INR	1234567890@customer.com	500	t	\N	\N	\N	Customer	f	1	$2a$12$hJUg5.7CSjXJ/tYalrZGGeKSwASmS0wVJ6Exv75.eL7AsyNp6hfG2	1234567890	Kitchen Master	CUSTOMER	t	2026-05-13 11:30:44.677924	FREE	2026-04-13 11:30:44.671454	5	2026-04-13 11:30:44.996723	\N	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	en	en	\N	\N	\N	\N	\N	\N
21	\N	2026-04-13 11:31:15.116201	INR	9876543210@customer.com	500	t	\N	\N	\N	Customer	f	1	$2a$12$.2AH5YBcqldZTm02qngZveLU3IE/89YVlDpYLAutHfr2AO9tvWlae	9876543210	Kitchen Master	CUSTOMER	t	2026-05-13 11:31:15.115616	FREE	2026-04-13 11:31:15.115616	5	2026-04-13 11:31:15.116201	\N	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	en	en	\N	\N	\N	\N	\N	\N
27	\N	2026-04-17 14:22:45.759417	INR	kjahgdkjashdk@gmail.com	500	f	\N	\N	\N	Kaushik	t	1	$2a$12$8nldCR36dAIZuHXpRgsDB.wuaw0d1UnuKgLeZNFT6PqokQpPVOVze	\N	BBQ	KITCHEN	t	2026-05-17 14:22:45.738221	FREE	2026-04-17 14:22:45.738221	5	2026-04-17 15:05:09.071153	1	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	en	en	#C6F53D	\N	\N	\N	\N	\N
22	\N	2026-04-15 10:40:13.943723	INR	stakeholder_100100100100@stakeholder.km	500	t	\N	\N	\N	Bala Murugan	t	1	$2a$12$fFhZK1JpK313Chi4GNPIlewvWLmhaBx41/2TLNpZQ7J00ooflycsW	100100100100	Stakeholder	STAKEHOLDER	t	2026-05-15 10:40:13.930468	FREE	2026-04-15 10:40:13.930468	5	2026-04-15 10:40:13.943723	\N	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	en	en	\N	\N	\N	\N	\N	\N
26	\N	2026-04-17 08:44:34.821305	INR	mm@gail.com	500	f	\N	\N	\N	sdfs	t	1	$2a$12$e0k7JarCpalTbO8GcgcBY.6fuNJ.uqdjP1ja1LfhuoN.fLG0Lsn5G	\N	BBQ	WAITER	t	2026-05-17 08:44:34.814885	FREE	2026-04-17 08:44:34.814885	5	2026-04-17 08:44:42.368854	1	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	en	en	#C6F53D	\N	\N	\N	\N	\N
25	\N	2026-04-16 14:20:56.716787	INR	email@gmail.com	500	f	\N	\N	\N	Name	t	1	$2a$12$Fj2bCHIz80Fhv/SrqVarh.xgo4uQujWNXe3UAj9uGqvNnrtThjPGO	\N	BBQ	WAITER	t	2026-05-16 14:20:56.716246	FREE	2026-04-16 14:20:56.716246	5	2026-04-17 08:44:57.05632	1	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	en	en	\N	\N	\N	\N	\N	\N
23	\N	2026-04-15 14:23:05.585278	INR	9841226592@customer.com	500	t	\N	\N	\N	Customer	f	1	$2a$12$.XTP.1hoOOwxbNxXYjHymufd6Sx99ya6R5CUH8lZZdNwL8kOM2XuS	9841226592	Kitchen Master	CUSTOMER	t	2026-05-15 14:23:05.536932	FREE	2026-04-15 14:23:05.536932	5	2026-04-15 14:23:05.586283	\N	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	en	en	\N	\N	\N	\N	\N	\N
28	\N	2026-04-17 15:06:55.992375	INR	kari@gmail.com	500	t	\N	\N	\N	Sankari	t	1	$2a$12$q9o9DeWBIIq77TyKUSZEBucOxuAPsfjTmkYGsBaVNTIwXPvxoWXRS	\N	BBQ	WAITER	t	2026-05-17 15:06:55.992376	FREE	2026-04-17 15:06:55.992376	5	2026-05-02 06:28:51.919533	1	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	en	en	#C6F53D	\N	\N	\N	\N	\N
29	Veppampattu	2026-04-20 13:03:08.30976	INR	madhavanm.0108@gmail.com	500	t	\N	\N	\N	Gayathri	f	1	$2a$12$WJ4zRAFaC5ZHihDOmaHVY.8iOeIXl6vgaOJmHpTaWGQjsMsC9EfVC	7401813016	Kitchen King	OWNER	t	2026-05-20 13:03:08.284273	FREE	2026-04-20 13:03:08.284273	5	2026-04-20 13:11:10.919144	\N	10	\N	\N	\N	t	f	t	f	f	f	t	f	t	f	MultiColor	5	Side Menu	0	1	f	f	f	t	f	f	t	t	t	f	+91	f	\N	\N	20	\N	\N	\N	f	\N	digital	restaurant	en	en	#C6F53D	t	Restaurant / Dine-In	1	Business	\N
1	3Q9J+3HH, Vazhaiyur, Tamil Nadu, 621104	2026-03-14 11:14:27.165176	INR	owner@gmail.com	500	t	11.0685432	/uploads/edb72258-b93b-4446-891c-6d44cf6e09e8.jpeg	78.7815388	Madhavan	t	3	$2a$12$pD6GqanG5m9PhZuDAYEg/Oe6Gcagsf5SSvLc51ydD2rTBcjgbumNy	9710082916	BBQ	OWNER	t	2028-04-13 11:14:27.078712	FREE	2026-03-14 11:14:27.078712	5	2026-05-02 07:46:16.363627	\N	15	205225	2026-03-19 17:57:54.169548	1234567889	t	f	t	f	f	f	t	f	t	t	MultiColor	4	Top Menu	0	1	t	f	f	t	f	f	t	t	t	f	+91 9710082916	t			20	1,2,3,4,5	{"1":{"seats":"4","location":"Ground Floor"},"2":{"seats":"6","location":"Ground Floor"},"3":{"seats":"10","location":"Ground Floor"},"4":{"seats":"4","location":"Ground Floor"},"5":{"location":"Balcony view tables","seats":"12"},"6":{"location":"Ground Floor"},"7":{"seats":"5","location":"First Floor"},"8":{"location":"Ground Floor"},"9":{"location":"First Floor"},"10":{"location":"Ground Floor"},"11":{"location":"First Floor"},"12":{"location":"First Floor"},"13":{"location":"First Floor"},"14":{"location":"First Floor"},"15":{"location":"First Floor"},"16":{"location":"First Floor"},"17":{"location":"First Floor"},"18":{"location":"First Floor"},"19":{"location":"Party Hall"},"20":{"location":"Party Hall"}}	["Ground Floor","First Floor","Party Hall","Balcony view tables"]	\N	\N	\N	restaurant	en	en	#C6F53D	t	\N	\N	\N	\N
\.


--
-- Name: attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_id_seq', 11, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 1, true);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_items_id_seq', 93, true);


--
-- Name: item_ingredients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.item_ingredients_id_seq', 1, false);


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 141, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_id_seq', 286, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 142, true);


--
-- Name: queue_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.queue_entries_id_seq', 3, true);


--
-- Name: stakeholder_mappings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stakeholder_mappings_id_seq', 11, true);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 93, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 29, true);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: item_ingredients item_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_ingredients
    ADD CONSTRAINT item_ingredients_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: queue_entries queue_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_entries
    ADD CONSTRAINT queue_entries_pkey PRIMARY KEY (id);


--
-- Name: stakeholder_mappings stakeholder_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stakeholder_mappings
    ADD CONSTRAINT stakeholder_mappings_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users uk_6dotkott2kjsp8vw4d0m25fb7; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uk_6dotkott2kjsp8vw4d0m25fb7 UNIQUE (email);


--
-- Name: orders uk_restaurant_order_number; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT uk_restaurant_order_number UNIQUE (restaurant_id, order_number);


--
-- Name: stakeholder_mappings uk_stakeholder_restaurant; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stakeholder_mappings
    ADD CONSTRAINT uk_stakeholder_restaurant UNIQUE (stakeholder_id, restaurant_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_attendance_employee_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_employee_date ON public.attendance USING btree (employee_id, date);


--
-- Name: idx_inventory_restaurant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_restaurant ON public.inventory_items USING btree (restaurant_id);


--
-- Name: idx_inventory_restaurant_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_restaurant_barcode ON public.inventory_items USING btree (restaurant_id, barcode);


--
-- Name: idx_inventory_restaurant_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_restaurant_name ON public.inventory_items USING btree (restaurant_id, name);


--
-- Name: idx_menu_available; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_available ON public.menu_items USING btree (restaurant_id, is_available);


--
-- Name: idx_menu_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_category ON public.menu_items USING btree (restaurant_id, category);


--
-- Name: idx_menu_restaurant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_restaurant ON public.menu_items USING btree (restaurant_id);


--
-- Name: idx_order_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_created ON public.orders USING btree (restaurant_id, created_at);


--
-- Name: idx_order_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_payment_status ON public.orders USING btree (restaurant_id, payment_status);


--
-- Name: idx_order_restaurant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_restaurant ON public.orders USING btree (restaurant_id);


--
-- Name: idx_order_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_status ON public.orders USING btree (restaurant_id, status);


--
-- Name: idx_queue_restaurant_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_queue_restaurant_date ON public.queue_entries USING btree (restaurant_id, created_at);


--
-- Name: idx_sm_restaurant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sm_restaurant ON public.stakeholder_mappings USING btree (restaurant_id);


--
-- Name: idx_sm_stakeholder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sm_stakeholder ON public.stakeholder_mappings USING btree (stakeholder_id);


--
-- Name: order_extra_charges fk6042dc4kv5o6agx0ddbad05x3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_extra_charges
    ADD CONSTRAINT fk6042dc4kv5o6agx0ddbad05x3 FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: stakeholder_mappings fk6d0adynn9p008u5omegeqvj9t; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stakeholder_mappings
    ADD CONSTRAINT fk6d0adynn9p008u5omegeqvj9t FOREIGN KEY (stakeholder_id) REFERENCES public.users(id);


--
-- Name: stock_movements fk82mrlg9h36kaw5kn90fliqu0b; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk82mrlg9h36kaw5kn90fliqu0b FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: attendance fk9xwdrbhbcpp37bmtycq3jihj7; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT fk9xwdrbhbcpp37bmtycq3jihj7 FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: transactions fka1qpjil99eksbajax63i4wu0j; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fka1qpjil99eksbajax63i4wu0j FOREIGN KEY (restaurant_id) REFERENCES public.users(id);


--
-- Name: order_items fkbioxgbv59vetrxe0ejfubep1w; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fkbioxgbv59vetrxe0ejfubep1w FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items fkdtfg1f49yr5yye2fpl2xid2xo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fkdtfg1f49yr5yye2fpl2xid2xo FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- Name: customers fke7gdr76gipaen7va6g5b9ey2m; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fke7gdr76gipaen7va6g5b9ey2m FOREIGN KEY (restaurant_id) REFERENCES public.users(id);


--
-- Name: queue_entries fkebjmw5ueox3e0g1cfm3nswvkw; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_entries
    ADD CONSTRAINT fkebjmw5ueox3e0g1cfm3nswvkw FOREIGN KEY (restaurant_id) REFERENCES public.users(id);


--
-- Name: inventory_items fkfuwo2t1wyov0j9fjh9nf9547f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT fkfuwo2t1wyov0j9fjh9nf9547f FOREIGN KEY (restaurant_id) REFERENCES public.users(id);


--
-- Name: attendance fkfw9fdsvu5wvt9o0efl3njsxdp; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT fkfw9fdsvu5wvt9o0efl3njsxdp FOREIGN KEY (restaurant_id) REFERENCES public.users(id);


--
-- Name: users fkjhddbkehvb6pp0qgbnmnv9mem; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fkjhddbkehvb6pp0qgbnmnv9mem FOREIGN KEY (parent_owner_id) REFERENCES public.users(id);


--
-- Name: stock_movements fklaob67k5ekyx7qnir6ekb99jy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fklaob67k5ekyx7qnir6ekb99jy FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: menu_items fklcaax90fqrixun71vgcrgh018; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT fklcaax90fqrixun71vgcrgh018 FOREIGN KEY (restaurant_id) REFERENCES public.users(id);


--
-- Name: user_assigned_tables fkltcf3f0np4o2ouv314u20o4lv; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_assigned_tables
    ADD CONSTRAINT fkltcf3f0np4o2ouv314u20o4lv FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stakeholder_mappings fkoh771t4pluil4mux7wkgygrmn; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stakeholder_mappings
    ADD CONSTRAINT fkoh771t4pluil4mux7wkgygrmn FOREIGN KEY (restaurant_id) REFERENCES public.users(id);


--
-- Name: orders fkplwnpspwk2pvi7856ea4891o; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fkplwnpspwk2pvi7856ea4891o FOREIGN KEY (restaurant_id) REFERENCES public.users(id);


--
-- Name: stock_movements fkpt8bksc9no6j9ufnaxlmhx553; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fkpt8bksc9no6j9ufnaxlmhx553 FOREIGN KEY (restaurant_id) REFERENCES public.users(id);


--
-- Name: menu_item_tags fkq0w40spbbg98xktnqo0paym6m; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_tags
    ADD CONSTRAINT fkq0w40spbbg98xktnqo0paym6m FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- Name: item_ingredients fkqkdye373gcbm70dbfu0gykkq8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_ingredients
    ADD CONSTRAINT fkqkdye373gcbm70dbfu0gykkq8 FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- Name: order_items fkqowo405y30aonnwp2j5iotw5h; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fkqowo405y30aonnwp2j5iotw5h FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: item_ingredients fkriqstjoj3jo2ux94ineyisaws; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_ingredients
    ADD CONSTRAINT fkriqstjoj3jo2ux94ineyisaws FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: stock_movements fksf8xqne4s20910sgk48jvyx4u; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fksf8xqne4s20910sgk48jvyx4u FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: orders fktjwuphstqm46uffgc7l1r27a9; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fktjwuphstqm46uffgc7l1r27a9 FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict ljTaxG4xfosFjGf8rq5riC0bKi54a9r1dERovVtXFEiLo7dRff2lwhfgZxeiZ5z

